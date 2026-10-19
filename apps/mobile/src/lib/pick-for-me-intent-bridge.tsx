import { removePendingInvocationAsync, useAppIntents } from "expo-app-intents";
import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "./auth-context";

/** Mount the queue consumer only when session restoration and navigation are ready. */
export function PickForMeIntentBridge() {
	const navigation = useRootNavigationState();
	const { isLoading } = useAuth();
	if (Platform.OS !== "ios" || isLoading || !navigation?.key) return null;
	return <ReadyPickForMeIntentBridge />;
}

function ReadyPickForMeIntentBridge() {
	const router = useRouter();
	const pathname = usePathname();
	const destination = useRef(pathname);
	useEffect(() => {
		destination.current = pathname;
	}, [pathname]);
	useAppIntents(async (pending) => {
		const invocations = pending.filter(({ name }) => name === "openPickForMe");
		if (!invocations.length) return;
		// Coalesce a pending batch. navigate reuses the chooser on a later replay;
		// it never creates a Watch, and the screen owns the account gates.
		if (destination.current !== "/pick-for-me") {
			router.navigate("/pick-for-me");
			destination.current = "/pick-for-me";
		}
		for (const { id } of invocations) {
			try {
				await removePendingInvocationAsync(id);
			} catch (error) {
				console.warn("Could not acknowledge Pick for me Shortcut", error);
			}
		}
	});
	return null;
}
