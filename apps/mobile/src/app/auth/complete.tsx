import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";

/**
 * Deep-link landing for the PDS OAuth redirect (`opnshelf://auth/complete`).
 *
 * On iOS the redirect is captured by `WebBrowser.openAuthSessionAsync` and this
 * screen never renders. On Android the OS often delivers the redirect here as a
 * fresh intent instead, so this route persists the returned session and routes
 * the user on — without it expo-router shows "Unmatched Route".
 */
type CompleteParams = {
	session?: string;
	error?: string;
};

function errorMessage(code: string): string {
	switch (code) {
		case "handle_required":
			return "Please provide your handle to sign in.";
		case "auth_failed":
			return "Authentication failed. Please check your handle and try again.";
		case "callback_failed":
			return "Something went wrong during sign in. Please try again.";
		default:
			return "An unexpected error occurred. Please try again.";
	}
}

export default function AuthCompleteScreen() {
	const { completeSession } = useAuth();
	const { session, error } = useLocalSearchParams<CompleteParams>();
	const [message, setMessage] = useState<string | null>(null);
	// Guard against double-invocation (re-renders / strict mode) completing twice.
	const handled = useRef(false);

	useEffect(() => {
		if (handled.current) {
			return;
		}
		handled.current = true;

		if (error) {
			setMessage(errorMessage(error));
			const timer = setTimeout(() => router.replace("/login"), 1500);
			return () => clearTimeout(timer);
		}
		if (!session) {
			router.replace("/login");
			return;
		}

		completeSession(session)
			.then(() => {
				// Hand off to the index gate, which routes to verify-email /
				// onboarding / tabs based on the freshly fetched user.
				router.replace("/");
			})
			.catch((err) => {
				console.error("Failed to complete auth:", err);
				setMessage("Failed to complete sign in. Please try again.");
				setTimeout(() => router.replace("/login"), 1500);
			});
	}, [completeSession, session, error]);

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
