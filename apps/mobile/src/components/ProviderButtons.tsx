import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	useColorScheme,
	View,
} from "react-native";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { AuthFlowError, authErrorMessage } from "@/lib/auth-error";
import { beginHandoff } from "@/lib/auth-handoff";
import { env } from "@/lib/env";
import { ProviderUnavailableError } from "@/lib/provider-error";
import {
	isGoogleConfigured,
	type Provider,
	signInWithProvider,
	supportsNativeApple,
} from "@/lib/provider-signin";

interface ProviderButtonsProps {
	/** Set while the surrounding screen runs its own auth flow. */
	disabled?: boolean;
	/**
	 * Reports whether a provider flow is running, so the screen can disable its
	 * own controls. Two flows at once would each complete a session and race
	 * navigation.
	 */
	onBusyChange?: (busy: boolean) => void;
}

/**
 * "Continue with Apple" / "Continue with Google" (ADR 0027).
 *
 * Apple and Google are equally prominent here because App Store guideline 4.8
 * is the reason the Google button can exist in this app at all.
 */
export function ProviderButtons({
	disabled = false,
	onBusyChange,
}: ProviderButtonsProps) {
	const { runAuthorizationUrl } = useAuth();
	const toast = useToast();
	const colorScheme = useColorScheme();
	const [busy, setBusy] = useState<Provider | null>(null);

	const googleAvailable = isGoogleConfigured();
	const locked = disabled || busy !== null;

	useEffect(() => {
		onBusyChange?.(busy !== null);
	}, [busy, onBusyChange]);

	/**
	 * Apple on Android has no native credential, so it runs the same browser
	 * leg the web uses. The handoff challenge goes with it, or the flow would
	 * finish in the browser and never come back to the app (ADR 0026).
	 */
	const runAppleInBrowser = async () => {
		const codeChallenge = await beginHandoff();
		const url = new URL("/auth/apple/start", env.apiUrl);
		url.searchParams.set("platform", "mobile");
		if (codeChallenge) url.searchParams.set("code_challenge", codeChallenge);
		const completed = await runAuthorizationUrl(url.toString());
		if (completed) router.replace("/");
	};

	const onPress = async (provider: Provider) => {
		if (locked) return;
		setBusy(provider);
		try {
			if (provider === "apple" && !supportsNativeApple()) {
				await runAppleInBrowser();
				return;
			}

			const result = await signInWithProvider(provider);
			if (result.kind === "cancelled") return;
			if (result.kind === "authorize") {
				const completed = await runAuthorizationUrl(result.authorizationUrl);
				if (completed) router.replace("/");
				return;
			}
			router.push({
				pathname: "/signup-handle",
				params: {
					provider,
					pendingToken: result.pendingToken,
					email: result.email,
				},
			});
		} catch (error) {
			if (error instanceof ProviderUnavailableError) {
				toast.error(error.message);
				return;
			}
			// The browser leg came back with a reason. Saying "try again" when the
			// answer is "Apple never verified that address" sends the user round a
			// loop that cannot succeed.
			if (error instanceof AuthFlowError) {
				toast.error(authErrorMessage(error.code));
				return;
			}
			toast.error(
				`Couldn't sign in with ${provider === "apple" ? "Apple" : "Google"}. Try again.`,
			);
		} finally {
			setBusy(null);
		}
	};

	// Apple is offered on every platform: natively on iOS, through the browser
	// elsewhere. Hiding it on Android would lock out anyone who signed up on an
	// iPhone.
	return (
		<View className="gap-3">
			{supportsNativeApple() ? (
				// Apple's guidelines require their own button wherever native Sign in
				// with Apple is offered, and guideline 4.8 is the whole reason this
				// screen has provider buttons — so this is not the place to draw our
				// own. Android keeps the custom one, where no such rule applies.
				<AppleAuthentication.AppleAuthenticationButton
					buttonType={
						AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
					}
					buttonStyle={
						colorScheme === "dark"
							? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
							: AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
					}
					cornerRadius={8}
					style={{ height: 48, opacity: locked ? 0.6 : 1 }}
					onPress={() => {
						if (!locked) void onPress("apple");
					}}
				/>
			) : (
				<Pressable
					disabled={locked}
					onPress={() => onPress("apple")}
					className="flex-row items-center justify-center gap-2 rounded-lg border border-border px-4 py-3"
					style={{ opacity: locked ? 0.6 : 1 }}
				>
					{busy === "apple" && <ActivityIndicator size="small" />}
					<Text className="font-semibold text-base text-foreground">
						Continue with Apple
					</Text>
				</Pressable>
			)}

			{googleAvailable ? (
				<Pressable
					disabled={locked}
					onPress={() => onPress("google")}
					className="flex-row items-center justify-center gap-2 rounded-lg border border-border px-4 py-3"
					style={{ opacity: locked ? 0.6 : 1 }}
				>
					{busy === "google" && <ActivityIndicator size="small" />}
					<Text className="font-semibold text-base text-foreground">
						Continue with Google
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}
