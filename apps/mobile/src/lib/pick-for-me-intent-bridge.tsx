import { removePendingInvocationAsync, useAppIntents } from "expo-app-intents";
import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { appShortcutDestination } from "./app-shortcut-destination";
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
	const { user } = useAuth();
	const handled = useRef(new Set<string>());
	const pathname = usePathname();
	const destination = useRef(pathname);
	useEffect(() => {
		destination.current = pathname;
	}, [pathname]);
	useAppIntents(async (pending) => {
		const invocations = pending.filter(
			(intent) => appShortcutDestination(intent, user) !== undefined,
		);
		if (!invocations.length) return;
		const unhandled = invocations.filter(({ id }) => !handled.current.has(id));
		// All actions open UI. If several arrived while cold, the latest valid request wins.
		const valid = unhandled
			.map((intent) => ({
				intent,
				route: appShortcutDestination(intent, user),
			}))
			.filter(({ route }) => route !== null);
		const latest = valid.at(-1);
		if (latest?.route) {
			const key =
				typeof latest.route === "string"
					? latest.route
					: JSON.stringify(latest.route);
			if (destination.current !== key) {
				router.navigate(latest.route);
				destination.current = key;
			}
		}
		for (const intent of unhandled) {
			if (appShortcutDestination(intent, user) === null)
				console.warn("Discarding invalid App Shortcut input", intent.name);
			handled.current.add(intent.id);
		}
		while (handled.current.size > 100) {
			const oldest = handled.current.values().next().value;
			if (oldest !== undefined) handled.current.delete(oldest);
		}
		for (const { id } of invocations) {
			try {
				await removePendingInvocationAsync(id);
			} catch (error) {
				console.warn("Could not acknowledge App Shortcut", error);
			}
		}
	});
	return null;
}
