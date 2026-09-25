import {
	notificationsControllerRegisterDevice,
	notificationsControllerRemoveDevice,
} from "@opnshelf/api";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { type Href, router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const REGISTERED_TOKEN_KEY = "opnshelf_registered_push_token";
let activeUserDid: string | null = null;
let generation = 0;
const registrations = new Map<AbortController, Promise<void>>();

/** Invalidate token work started for a previous account. */
export function setPushUser(did: string | null): void {
	if (activeUserDid === did) return;
	activeUserDid = did;
	generation++;
	for (const controller of registrations.keys()) controller.abort();
}

async function registerToken(
	token: string,
	expectedGeneration: number,
): Promise<void> {
	if (generation !== expectedGeneration || !activeUserDid) return;
	// Keep the token independently of permission so sign-out can remove it later.
	await SecureStore.setItemAsync(REGISTERED_TOKEN_KEY, token);
	if (generation !== expectedGeneration || !activeUserDid) return;
	const controller = new AbortController();
	const request = notificationsControllerRegisterDevice({
		body: { token, platform: Platform.OS === "ios" ? "ios" : "android" },
		signal: controller.signal,
		throwOnError: true,
	}).then(() => undefined);
	registrations.set(controller, request);
	try {
		await request;
	} finally {
		registrations.delete(controller);
	}
}

async function ensureAndroidChannel(): Promise<void> {
	if (Platform.OS !== "android") return;
	await Notifications.setNotificationChannelAsync("releases", {
		name: "Releases and watch stats",
		importance: Notifications.AndroidImportance.DEFAULT,
	});
}

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
	await ensureAndroidChannel();
	const projectId =
		Constants.easConfig?.projectId ??
		Constants.expoConfig?.extra?.eas?.projectId;
	if (typeof projectId !== "string") return null;
	return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

export async function requestAndRegisterPush(): Promise<boolean> {
	if (!Device.isDevice || !activeUserDid) return false;
	const expectedGeneration = generation;
	await ensureAndroidChannel();
	const permission = await Notifications.requestPermissionsAsync();
	if (!hasPermission(permission)) return false;
	const token = await expoToken();
	if (!token || generation !== expectedGeneration) return false;
	await registerToken(token, expectedGeneration);
	return true;
}

export async function syncAuthorizedPush(): Promise<void> {
	if (!Device.isDevice || !activeUserDid) return;
	const expectedGeneration = generation;
	if (!hasPermission(await Notifications.getPermissionsAsync())) return;
	const token = await expoToken();
	if (token) await registerToken(token, expectedGeneration);
}

export async function removeCurrentPushDevice(): Promise<void> {
	setPushUser(null);
	await Promise.race([
		Promise.allSettled([...registrations.values()]),
		new Promise<void>((resolve) => setTimeout(resolve, 500)),
	]);
	const token = await SecureStore.getItemAsync(REGISTERED_TOKEN_KEY);
	if (!token) return;
	await notificationsControllerRemoveDevice({
		body: { token },
		throwOnError: true,
	});
	await SecureStore.deleteItemAsync(REGISTERED_TOKEN_KEY);
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
