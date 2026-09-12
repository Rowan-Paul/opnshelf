import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { type ReactNode, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	Text,
	useColorScheme,
	View,
} from "react-native";
import { AppleMark } from "@/components/marks/AppleMark";
import { GoogleMark } from "@/components/marks/GoogleMark";
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

/**
 * Shared geometry. Both providers get the same box, because Apple asks that
 * their button be no less prominent than the alternatives and a lopsided pair
 * steers the choice anyway. 16 is `--radius-lg`, the app's button radius.
 */
const BUTTON_HEIGHT = 48;
const BUTTON_RADIUS = 16;
/**
 * Apple's button, matched to BUTTON_RADIUS by eye rather than by number.
 *
 * `AppleAuthenticationButton` does not draw a CALayer corner: at 16 it renders
 * a near-semicircular cap far rounder than a 16px `borderRadius` beside it,
 * and at 8 it renders tighter. 12 is the value that lines up at
 * BUTTON_HEIGHT - verified against a screenshot, so re-check it if that
 * height changes.
 */
const APPLE_CORNER_RADIUS = 12;
const MARK_SIZE = 18;
/**
 * The weighted family registered in `app/_layout.tsx`, not `font-semibold`.
 * React Native cannot synthesize a weight, so each one is its own family, and
 * these labels carry vendor-mandated colours that must not be overridden by
 * the themed Text primitive's own `text-foreground`.
 */
const LABEL_FONT = "Inter-SemiBold";

/**
 * Google's published button specification, verbatim.
 *
 * https://developers.google.com/identity/branding-guidelines
 *
 * The fill, stroke and text colours are branding requirements and are not
 * theme tokens — they must be these values, in these themes. The type size is
 * the one deliberate departure: the spec's 14/20 pairs with Google's own 40pt
 * reference button, and this one is 48 to sit level with Apple's.
 */
const GOOGLE = {
	light: { fill: "#FFFFFF", stroke: "#747775", text: "#1F1F1F" },
	dark: { fill: "#131314", stroke: "#8E918F", text: "#E3E3E3" },
} as const;

/**
 * Apple's approved button colours for a custom button, which is Android only —
 * iOS uses `AppleAuthenticationButton` and lets the system draw it.
 *
 * Apple permits black, white, and white with an outline. These mirror Google's
 * two themes so the pair reads as one control in both, rather than as a vendor
 * button next to an app button.
 */
const APPLE = {
	light: { fill: "#FFFFFF", stroke: "#000000", content: "#000000" },
	dark: { fill: "#000000", stroke: "#000000", content: "#FFFFFF" },
} as const;

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
 * One provider button: mark, label, and nothing else.
 *
 * The spinner is absolutely positioned rather than inserted into the row,
 * because a spinner that takes part in the layout shoves the label sideways
 * the moment you tap.
 */
function ProviderButton({
	label,
	mark,
	fill,
	stroke,
	textColor,
	busy,
	disabled,
	onPress,
}: {
	label: string;
	mark: ReactNode;
	fill: string;
	stroke: string;
	textColor: string;
	busy: boolean;
	disabled: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled, busy }}
			disabled={disabled}
			onPress={onPress}
			style={{
				height: BUTTON_HEIGHT,
				borderRadius: BUTTON_RADIUS,
				backgroundColor: fill,
				borderWidth: 1,
				borderColor: stroke,
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "center",
				gap: 12,
				opacity: disabled ? 0.6 : 1,
			}}
		>
			{mark}
			<Text style={{ color: textColor, fontFamily: LABEL_FONT, fontSize: 16 }}>
				{label}
			</Text>
			{busy ? (
				<View
					style={{
						position: "absolute",
						right: 16,
						top: 0,
						bottom: 0,
						justifyContent: "center",
					}}
				>
					<ActivityIndicator size="small" color={textColor} />
				</View>
			) : null}
		</Pressable>
	);
}

/**
 * "Continue with Apple" / "Continue with Google" (ADR 0027).
 *
 * Both labels are approved by their respective vendor, and both buttons are
 * the same size on purpose: App Store guideline 4.8 is the reason the Google
 * button can exist in this app at all, so neither may read as the default.
 */
export function ProviderButtons({
	disabled = false,
	onBusyChange,
}: ProviderButtonsProps) {
	const { runAuthorizationUrl } = useAuth();
	const toast = useToast();
	const dark = useColorScheme() === "dark";
	const [busy, setBusy] = useState<Provider | null>(null);

	const googleAvailable = isGoogleConfigured();
	const locked = disabled || busy !== null;
	const google = dark ? GOOGLE.dark : GOOGLE.light;
	const apple = dark ? APPLE.dark : APPLE.light;

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
				// Drawn by the system, so it is compliant by construction — the only
				// things set here are the two Apple exposes as adjustable. The style
				// tracks the theme the same way Google's does: a light surface with
				// an outline, or a dark one.
				<AppleAuthentication.AppleAuthenticationButton
					buttonType={
						AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
					}
					buttonStyle={
						dark
							? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
							: AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE
					}
					cornerRadius={APPLE_CORNER_RADIUS}
					style={{ height: BUTTON_HEIGHT, opacity: locked ? 0.6 : 1 }}
					onPress={() => {
						if (!locked) void onPress("apple");
					}}
				/>
			) : (
				<ProviderButton
					label="Continue with Apple"
					mark={<AppleMark size={MARK_SIZE} color={apple.content} />}
					fill={apple.fill}
					stroke={apple.stroke}
					textColor={apple.content}
					busy={busy === "apple"}
					disabled={locked}
					onPress={() => onPress("apple")}
				/>
			)}

			{googleAvailable ? (
				<ProviderButton
					label="Continue with Google"
					mark={<GoogleMark size={MARK_SIZE} />}
					fill={google.fill}
					stroke={google.stroke}
					textColor={google.text}
					busy={busy === "google"}
					disabled={locked}
					onPress={() => onPress("google")}
				/>
			) : null}
		</View>
	);
}
