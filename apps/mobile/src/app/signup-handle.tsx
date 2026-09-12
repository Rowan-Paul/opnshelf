import {
	authControllerAppleRegister,
	authControllerGoogleRegister,
} from "@opnshelf/api";
import { useMutation } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import type { Provider } from "@/lib/provider-signin";

/** Pull a human-readable message out of a NestJS error body (string or string[]). */
function extractRegisterErrorMessage(error: unknown): string {
	const fallback = "Signup failed. Please try again.";
	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		if (Array.isArray(message)) return message.join(", ");
		if (typeof message === "string" && message.length > 0) return message;
	}
	return fallback;
}

function detectTimezone(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
	} catch {
		return undefined;
	}
}

/**
 * The handle picker for a native provider sign-in.
 *
 * The web flow parks its pending registration in a cookie and renders the same
 * step at /signup/{provider}; a native client has no cookie jar, so it carries
 * the pending token in navigation params instead and sends it back with the
 * registration. Rendered natively rather than in a webview because mobile
 * onboarding parity is the standing commitment (ADR 0006).
 */
export default function SignupHandleScreen() {
	const params = useLocalSearchParams<{
		provider?: string;
		pendingToken?: string;
		email?: string;
	}>();
	// Deep links and restored router params can carry anything. An unchecked
	// cast would let any non-"apple" string select the Google endpoint, which
	// would post an Apple pending registration to it.
	const provider: Provider | undefined =
		params.provider === "apple" || params.provider === "google"
			? params.provider
			: undefined;
	const { pendingToken, email } = params;

	const { isAuthenticated, isLoading, login, runAuthorizationUrl } = useAuth();
	const toast = useToast();
	const [username, setUsername] = useState("");
	const [captchaToken, setCaptchaToken] = useState<string | null>(null);
	/**
	 * Set once the account exists on the PDS. From that point the handle is
	 * taken, the pending registration is spent and the captcha token is used, so
	 * offering "Create account" again is offering something that cannot succeed.
	 */
	const [createdHandle, setCreatedHandle] = useState<string | null>(null);

	const siteKey = env.turnstileSiteKey;
	const handleDomain = env.pdsHandleDomain;
	const captchaReady = !siteKey || captchaToken !== null;

	const onVerify = useCallback((token: string) => setCaptchaToken(token), []);
	const onExpire = useCallback(() => setCaptchaToken(null), []);
	const onCaptchaError = useCallback(
		(code: string) => {
			setCaptchaToken(null);
			toast.error(`Captcha couldn't load (${code}). Pull down to retry.`);
		},
		[toast],
	);

	const registerMutation = useMutation({
		mutationKey: ["auth", "provider-register", provider],
		mutationFn: async (input: {
			username: string;
			captchaToken: string;
			timezone?: string;
			pendingToken: string;
		}) => {
			const call =
				provider === "apple"
					? authControllerAppleRegister
					: authControllerGoogleRegister;
			const { data } = await call({ body: input, throwOnError: true });
			if (!data?.coreOAuthUrl) {
				throw new Error("Registration returned nowhere to continue");
			}
			// The account exists but holds no scopes yet. Its PDS consent page is
			// what grants them, and its callback seeds the profile and default
			// lists, so the flow has to run before the app is usable.
			return data;
		},
		onSuccess: async ({ handle, coreOAuthUrl }) => {
			// Before the browser opens: the account is already created by now, and
			// this screen must never offer to create it again.
			setCreatedHandle(handle);
			const completed = await runAuthorizationUrl(coreOAuthUrl);
			if (completed) {
				router.replace("/");
				return;
			}
			// The browser was dismissed without finishing. isSubmitting stays true
			// while the mutation reads as successful, so without this reset the
			// screen is stuck behind a disabled button with no way forward.
			registerMutation.reset();
			toast.error("Sign-in wasn't completed. Try again.");
		},
		onError: (error) => {
			toast.error(extractRegisterErrorMessage(error));
			setCaptchaToken(null);
		},
	});

	/**
	 * Finish an account that exists but was never authorized.
	 *
	 * A fresh login rather than a replay of the registration's coreOAuthUrl:
	 * that URL's request_uri is single-use and may already be spent, whereas the
	 * account is real now and can simply sign in.
	 */
	const continueMutation = useMutation({
		mutationKey: ["auth", "provider-continue", provider],
		mutationFn: async (handle: string) => login(handle),
		onSuccess: (completed) => {
			if (completed) {
				router.replace("/");
				return;
			}
			toast.error("Sign-in wasn't completed. Try again.");
		},
		onError: (error) => toast.error(extractRegisterErrorMessage(error)),
	});

	const isSubmitting = registerMutation.isPending || registerMutation.isSuccess;

	if (
		!isLoading &&
		isAuthenticated &&
		!registerMutation.isPending &&
		!registerMutation.isSuccess &&
		!continueMutation.isPending
	) {
		return <Redirect href="/" />;
	}

	// Reached without a pending registration (a stale back-navigation). There is
	// nothing to finish, so send them back rather than showing a dead form.
	if (!pendingToken || !provider) {
		return <Redirect href="/signup" />;
	}

	const trimmedUsername = username.trim().toLowerCase();
	const canSubmit =
		!isSubmitting && trimmedUsername.length >= 3 && captchaReady;

	const handleSubmit = () => {
		if (!canSubmit) {
			if (!captchaReady) toast.error("Please complete the captcha first.");
			return;
		}
		registerMutation.mutate({
			username: trimmedUsername,
			captchaToken: captchaToken ?? "",
			timezone: detectTimezone(),
			pendingToken,
		});
	};

	const providerName = provider === "apple" ? "Apple" : "Google";

	// The account exists; only the authorization is missing. Re-showing the form
	// would send the user round a loop that fails three ways at once: the handle
	// is taken, the pending registration is spent, and Turnstile only honours a
	// token once.
	if (createdHandle) {
		return (
			<Screen>
				<ScrollView contentContainerClassName="flex-grow justify-center gap-6 py-8">
					<View className="gap-2">
						<Text className="font-bold font-display text-4xl text-foreground">
							Almost there
						</Text>
						<Text className="text-base text-muted-foreground">
							Your account {createdHandle} is ready. Finish signing in to grant
							Opnshelf access to it.
						</Text>
					</View>

					<Pressable
						disabled={continueMutation.isPending}
						onPress={() => continueMutation.mutate(createdHandle)}
						className="flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3"
						style={{ opacity: continueMutation.isPending ? 0.6 : 1 }}
					>
						{continueMutation.isPending && (
							<ActivityIndicator size="small" color="#3f2e00" />
						)}
						<Text className="font-semibold text-base text-primary-foreground">
							{continueMutation.isPending
								? "Signing in"
								: "Continue signing in"}
						</Text>
					</Pressable>
				</ScrollView>
			</Screen>
		);
	}

	return (
		<Screen>
			<ScrollView
				contentContainerClassName="flex-grow justify-center gap-6 py-8"
				keyboardShouldPersistTaps="handled"
			>
				<View className="gap-2">
					<Text className="font-bold font-display text-4xl text-foreground">
						Pick your handle
					</Text>
					<Text className="text-base text-muted-foreground">
						One more step and your Opnshelf account is ready.
					</Text>
				</View>

				{email ? (
					<View className="rounded-lg border border-border px-3 py-2">
						<Text className="text-muted-foreground text-sm">
							Signed in with {providerName} as {email}
						</Text>
					</View>
				) : null}

				<View className="gap-4">
					<TextField
						label="Username"
						value={username}
						onChangeText={setUsername}
						placeholder="yourname"
						autoCapitalize="none"
						autoCorrect={false}
						autoComplete="username"
						editable={!isSubmitting}
						trailing={
							<Text className="text-muted-foreground text-sm">
								.{handleDomain}
							</Text>
						}
						helperText={`This becomes your handle: ${
							trimmedUsername || "yourname"
						}.${handleDomain}`}
					/>

					<TurnstileWidget
						siteKey={siteKey}
						onVerify={onVerify}
						onExpire={onExpire}
						onError={onCaptchaError}
					/>

					<Pressable
						disabled={!canSubmit}
						onPress={handleSubmit}
						className="flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3"
						style={{ opacity: canSubmit ? 1 : 0.6 }}
					>
						{isSubmitting && <ActivityIndicator size="small" color="#3f2e00" />}
						<Text className="font-semibold text-base text-primary-foreground">
							{isSubmitting ? "Creating account" : "Create account"}
						</Text>
					</Pressable>
				</View>

				<Pressable
					disabled={isSubmitting}
					onPress={() => router.replace("/signup")}
					className="items-center justify-center"
				>
					<Text className="text-muted-foreground text-sm">
						Wrong {providerName} account?{" "}
						<Text className="font-semibold text-accent">Start again</Text>
					</Text>
				</Pressable>
			</ScrollView>
		</Screen>
	);
}
