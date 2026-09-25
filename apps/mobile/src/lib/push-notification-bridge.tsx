import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { useAuth } from "./auth-context";
import { openPushResponse, syncAuthorizedPush } from "./push-notifications";

/** Keeps a granted install registered and opens shared Web/Mobile detail URLs. */
export function PushNotificationBridge() {
	const { user, isLoading } = useAuth();
	const openedResponse = useRef<string | null>(null);
	useEffect(() => {
		if (
			isLoading ||
			!user ||
			user.needsOnboarding ||
			user.needsEmailVerification
		)
			return;
		void syncAuthorizedPush().catch((error) =>
			console.warn("Could not sync push token", error),
		);
		const tokenListener = Notifications.addPushTokenListener(() => {
			void syncAuthorizedPush().catch((error) =>
				console.warn("Could not refresh push token", error),
			);
		});
		const openOnce = (response: Notifications.NotificationResponse) => {
			const id = response.notification.request.identifier;
			if (openedResponse.current === id) return;
			openedResponse.current = id;
			openPushResponse(response);
		};
		const responseListener =
			Notifications.addNotificationResponseReceivedListener(openOnce);
		void Notifications.getLastNotificationResponseAsync().then((response) => {
			if (response) openOnce(response);
		});
		return () => {
			tokenListener.remove();
			responseListener.remove();
		};
	}, [isLoading, user]);
	return null;
}
