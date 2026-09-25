import {
	notificationsControllerRegisterDevice,
	notificationsControllerRemoveDevice,
} from "@opnshelf/api";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { type Href, router } from "expo-router";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

function hasPermission(
	status: Notifications.NotificationPermissionsStatus,
): boolean {
	return (
		status.granted ||
		status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
	);
}

async function expoToken(): Promise<string | null> {
	if (!Device.isDevice || Platform.OS === "web") return null;
	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync("releases", {
			name: "Releases and watch stats",
			importance: Notifications.AndroidImportance.DEFAULT,
		});
	}
	const projectId =
		Constants.easConfig?.projectId ??
		Constants.expoConfig?.extra?.eas?.projectId;
	if (typeof projectId !== "string") return null;
	return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

export async function requestAndRegisterPush(): Promise<boolean> {
	if (!Device.isDevice) return false;
	const permission = await Notifications.requestPermissionsAsync();
	if (!hasPermission(permission)) return false;
	const token = await expoToken();
	if (!token) return false;
	await notificationsControllerRegisterDevice({
		body: { token, platform: Platform.OS === "ios" ? "ios" : "android" },
		throwOnError: true,
	});
	return true;
}

export async function syncAuthorizedPush(): Promise<void> {
	if (!Device.isDevice) return;
	if (!hasPermission(await Notifications.getPermissionsAsync())) return;
	const token = await expoToken();
	if (!token) return;
	await notificationsControllerRegisterDevice({
		body: { token, platform: Platform.OS === "ios" ? "ios" : "android" },
		throwOnError: true,
	});
}

export async function removeCurrentPushDevice(): Promise<void> {
	if (
		!Device.isDevice ||
		!hasPermission(await Notifications.getPermissionsAsync())
	)
		return;
	const token = await expoToken();
	if (token)
		await notificationsControllerRemoveDevice({
			body: { token },
			throwOnError: true,
		});
}

export function openPushResponse(
	response: Notifications.NotificationResponse,
): void {
	const path = response.notification.request.content.data?.path;
	if (
		typeof path === "string" &&
		path.startsWith("/") &&
		!path.startsWith("//")
	) {
		router.push(path as Href);
	}
}
