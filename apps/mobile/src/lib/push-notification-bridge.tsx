import { notificationsControllerSettingsOptions } from "@opnshelf/api";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { useAuth } from "./auth-context";
import {
	openPushResponse,
	setPushUser,
	syncAuthorizedPush,
} from "./push-notifications";

/** Keeps a granted install registered and opens shared Web/Mobile detail URLs. */
export function PushNotificationBridge() {
	const { user, isLoading } = useAuth();
	const did = user?.did;
	const needsOnboarding = user?.needsOnboarding;
	const needsEmailVerification = user?.needsEmailVerification;
	const openedResponse = useRef<string | null>(null);
	const queryClient = useQueryClient();
	useEffect(() => {
		setPushUser(did ?? null);
		if (isLoading || !did || needsOnboarding || needsEmailVerification) return;
		let active = true;
		// Settings shows the test button only once a device is registered.
		const refreshSettings = () =>
			queryClient.invalidateQueries({
				queryKey: notificationsControllerSettingsOptions().queryKey,
			});
		void syncAuthorizedPush()
			.then(refreshSettings)
			.catch((error) => console.warn("Could not sync push token", error));
		const tokenListener = Notifications.addPushTokenListener((token) => {
			void syncAuthorizedPush(token)
				.then(refreshSettings)
				.catch((error) => console.warn("Could not refresh push token", error));
		});
		const openOnce = (response: Notifications.NotificationResponse) => {
			if (!active) return;
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
			active = false;
			setPushUser(null);
			tokenListener.remove();
			responseListener.remove();
		};
	}, [isLoading, did, needsOnboarding, needsEmailVerification, queryClient]);
	return null;
}
