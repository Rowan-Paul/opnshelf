import { type Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { authErrorMessage } from "@/lib/auth-error";
import { NoPendingHandoffError } from "@/lib/handoff-error";

/**
 * Deep-link landing for the PDS OAuth redirect (`opnshelf://auth/complete`).
 *
 * On iOS the redirect is captured by `WebBrowser.openAuthSessionAsync` and this
 * screen never renders. On Android the OS often delivers the redirect here as a
 * fresh intent instead, so this route redeems the handoff code (ADR 0026) and
 * routes the user on — without it expo-router shows "Unmatched Route".
 *
 * A signed-in user re-authorizing (a permission change) started from a screen
 * that is still underneath, mid-flow. Replacing to the index gate would mount a
 * fresh copy of that screen and lose its state (onboarding restarted at
 * Welcome), so this route steps back to it instead.
 */
type CompleteParams = {
	/** Single-use Mobile Handoff Code, redeemed with the stored verifier. */
	code?: string;
	/** Legacy: the session id itself, from a backend that predates the code. */
	session?: string;
	error?: string;
	permission?: string;
};

function isMaintenanceError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const value = error as Record<string, unknown>;
	return value.status === 503 || value.statusCode === 503;
}

export default function AuthCompleteScreen() {
	const { completeSession, completeHandoff, consumeReauthorization } =
		useAuth();
	const { code, session, error, permission } =
		useLocalSearchParams<CompleteParams>();
	const [message, setMessage] = useState<string | null>(null);
	// Guard against double-invocation (re-renders / strict mode) completing twice.
	const handled = useRef(false);

	useEffect(() => {
		if (handled.current) {
			return;
		}
		handled.current = true;
		// The AT Store prompt navigates on its own after its grant, and stepping
		// back here could pop the screen it just opened, so it keeps its route.
		const returnToCaller =
			permission !== "atstore" &&
			consumeReauthorization() &&
			router.canGoBack();

		if (error) {
			setMessage(authErrorMessage(error));
			const timer = setTimeout(
				() =>
					returnToCaller
						? router.back()
						: router.replace(permission === "atstore" ? "/" : "/login"),
				1500,
			);
			return () => clearTimeout(timer);
		}
		const complete = code
			? completeHandoff(code)
			: session
				? completeSession(session)
				: null;
		if (!complete) {
			router.replace("/login");
			return;
		}

		complete
			.then(() => {
				if (returnToCaller) {
					router.back();
					return;
				}
				// Hand off to the index gate, which routes to verify-email /
				// onboarding / tabs based on the freshly fetched user.
				router.replace(
					(permission === "atstore" ? "/atstore-review" : "/") as Href,
				);
			})
			.catch((err) => {
				// The auth session can complete the same sign-in: on Android both
				// paths run and race for one verifier. Losing it here is not a
				// failure, and reporting one would bounce a signed-in user to the
				// login screen. Hand to the index gate, which sends them to login
				// only if no session actually landed.
				if (err instanceof NoPendingHandoffError) {
					if (returnToCaller) router.back();
					else router.replace("/" as Href);
					return;
				}
				console.error("Failed to complete auth:", err);
				setMessage(
					isMaintenanceError(err)
						? "Account storage maintenance is in progress. Please try again shortly."
						: "Failed to complete sign in. Please try again.",
				);
				setTimeout(() => router.replace("/login"), 1500);
			});
	}, [
		completeHandoff,
		completeSession,
		consumeReauthorization,
		code,
		session,
		error,
		permission,
	]);

	return (
		<Screen>
			<View className="flex-1 items-center justify-center gap-4">
				{message ? (
					<Text className="text-center text-muted-foreground">{message}</Text>
				) : (
					<>
						<ActivityIndicator size="large" />
						<Text className="text-muted-foreground">Completing sign in…</Text>
					</>
				)}
			</View>
		</Screen>
	);
}
