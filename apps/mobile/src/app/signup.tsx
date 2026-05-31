import { useMutation } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useCallback, useState } from "react";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";

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

export default function SignupScreen() {
	const { isAuthenticated, isLoading, register } = useAuth();
	const toast = useToast();
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [captchaToken, setCaptchaToken] = useState<string | null>(null);

	const siteKey = env.turnstileSiteKey;
	const handleDomain = env.pdsHandleDomain;
	// With no site key the widget reports an empty token immediately, so the
	// captcha is effectively "ready" as soon as that fires.
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
		mutationKey: ["auth", "register"],
		mutationFn: register,
		onSuccess: () => {
			// Account exists and the session is live, but the PDS won't accept any
			// record writes until the email is verified — funnel through there.
			router.replace("/verify-email");
		},
		onError: (error) => {
			toast.error(extractRegisterErrorMessage(error));
			setCaptchaToken(null);
		},
	});

	// Stay locked through the whole submit lifecycle: while pending and after
	// success (the gap before we navigate away would otherwise let a fast
	// double-tap register twice).
	const isSubmitting = registerMutation.isPending || registerMutation.isSuccess;

	// Already signed in (and not mid-signup): let the index gate route us. We
	// must exclude the in-flight register too — its `me` fetch flips
	// `isAuthenticated` before onSuccess navigates, which would otherwise bounce
	// through "/" instead of going straight to /verify-email.
	if (
		!isLoading &&
		isAuthenticated &&
		!registerMutation.isPending &&
		!registerMutation.isSuccess
	) {
		return <Redirect href="/" />;
	}

	const trimmedUsername = username.trim().toLowerCase();
	const canSubmit =
		!isSubmitting &&
		trimmedUsername.length >= 3 &&
		email.trim().length > 0 &&
		password.length >= 8 &&
		captchaReady;

	const handleSubmit = () => {
		if (!canSubmit) {
			if (!captchaReady) toast.error("Please complete the captcha first.");
			return;
		}
		registerMutation.mutate({
			username: trimmedUsername,
			email: email.trim(),
			password,
			captchaToken: captchaToken ?? "",
			timezone: detectTimezone(),
		});
	};

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			className="flex-1"
		>
			<Screen>
				<ScrollView
					contentContainerClassName="flex-grow justify-center gap-6 py-8"
					keyboardShouldPersistTaps="handled"
				>
					<View className="gap-2">
						<Text className="font-bold font-display text-4xl text-foreground">
							Create your account
						</Text>
						<Text className="text-base text-muted-foreground">
							Your account lives on OpnShelf's AT Protocol server.
						</Text>
					</View>

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

						<TextField
							label="Email"
							value={email}
							onChangeText={setEmail}
							placeholder="you@example.com"
							autoCapitalize="none"
							autoCorrect={false}
							keyboardType="email-address"
							autoComplete="email"
							editable={!isSubmitting}
							helperText="The PDS requires an email for account recovery and verification. OpnShelf itself never stores it."
						/>

						<TextField
							label="Password"
							value={password}
							onChangeText={setPassword}
							placeholder="At least 8 characters"
							autoCapitalize="none"
							autoCorrect={false}
							secureTextEntry
							autoComplete="new-password"
							editable={!isSubmitting}
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
							{isSubmitting && (
								<ActivityIndicator size="small" color="#3f2e00" />
							)}
							<Text className="font-semibold text-base text-primary-foreground">
								{isSubmitting ? "Creating account" : "Create account"}
							</Text>
						</Pressable>
					</View>

					<Pressable
						disabled={isSubmitting}
						onPress={() => router.replace("/login")}
						className="items-center justify-center"
					>
						<Text className="text-muted-foreground text-sm">
							Already have an account?{" "}
							<Text className="font-semibold text-accent">Sign in</Text>
						</Text>
					</Pressable>
				</ScrollView>
			</Screen>
		</KeyboardAvoidingView>
	);
}
