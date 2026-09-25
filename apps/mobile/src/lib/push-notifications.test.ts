import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	register: vi.fn(),
	remove: vi.fn(),
	getPermissions: vi.fn(),
	requestPermissions: vi.fn(),
	getToken: vi.fn(),
	setChannel: vi.fn(),
	getStored: vi.fn(),
	setStored: vi.fn(),
	deleteStored: vi.fn(),
}));

vi.mock("@opnshelf/api", () => ({
	notificationsControllerRegisterDevice: mocks.register,
	notificationsControllerRemoveDevice: mocks.remove,
}));
vi.mock("expo-constants", () => ({
	default: { easConfig: { projectId: "project" } },
}));
vi.mock("expo-device", () => ({ isDevice: true }));
vi.mock("expo-notifications", () => ({
	AndroidImportance: { DEFAULT: 3 },
	IosAuthorizationStatus: { PROVISIONAL: 3 },
	setNotificationHandler: vi.fn(),
	getPermissionsAsync: mocks.getPermissions,
	requestPermissionsAsync: mocks.requestPermissions,
	getExpoPushTokenAsync: mocks.getToken,
	setNotificationChannelAsync: mocks.setChannel,
}));
vi.mock("expo-secure-store", () => ({
	getItemAsync: mocks.getStored,
	setItemAsync: mocks.setStored,
	deleteItemAsync: mocks.deleteStored,
}));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

import {
	removeCurrentPushDevice,
	requestAndRegisterPush,
	setPushUser,
	syncAuthorizedPush,
} from "./push-notifications";

describe("push registration", () => {
	beforeEach(() => {
		setPushUser(null);
		vi.clearAllMocks();
		mocks.register.mockResolvedValue({});
		mocks.remove.mockResolvedValue({});
		mocks.setChannel.mockResolvedValue(undefined);
		mocks.setStored.mockResolvedValue(undefined);
		mocks.deleteStored.mockResolvedValue(undefined);
		mocks.getStored.mockResolvedValue("ExpoPushToken[known]");
		mocks.getPermissions.mockResolvedValue({ granted: true });
		mocks.requestPermissions.mockResolvedValue({ granted: true });
		mocks.getToken.mockResolvedValue({ data: "ExpoPushToken[known]" });
	});

	it("reports permission before a failed Android token fetch", async () => {
		setPushUser("did:plc:alice");
		mocks.getToken.mockRejectedValue(new Error("INTERNAL_SERVER_ERROR"));
		const permissionChanged = vi.fn();
		await expect(requestAndRegisterPush(permissionChanged)).rejects.toThrow();
		expect(permissionChanged).toHaveBeenCalledWith(true);
		expect(mocks.register).not.toHaveBeenCalled();
	});

	it("shares concurrent token fetches from enabling and the token listener", async () => {
		setPushUser("did:plc:alice");
		let finishToken!: (value: { data: string }) => void;
		mocks.getToken.mockReturnValue(
			new Promise((resolve) => {
				finishToken = resolve;
			}),
		);
		const enabling = requestAndRegisterPush();
		await vi.waitFor(() => expect(mocks.getToken).toHaveBeenCalled());
		const syncing = syncAuthorizedPush();
		await new Promise((resolve) => setTimeout(resolve, 0));
		finishToken({ data: "ExpoPushToken[known]" });
		await Promise.all([enabling, syncing]);
		expect(mocks.getToken).toHaveBeenCalledOnce();
		expect(mocks.register).toHaveBeenCalledOnce();
	});

	it("uses a rotated native token without asking the native service for it again", async () => {
		setPushUser("did:plc:alice");
		const devicePushToken = { type: "android", data: "rotated" } as const;
		await syncAuthorizedPush(devicePushToken);
		expect(mocks.getToken).toHaveBeenCalledWith({
			projectId: "project",
			devicePushToken,
		});
	});

	it("creates the Android channel before asking for permission", async () => {
		setPushUser("did:plc:alice");
		expect(await requestAndRegisterPush()).toBe(true);
		expect(mocks.setChannel.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.requestPermissions.mock.invocationCallOrder[0],
		);
		expect(mocks.register).toHaveBeenCalledOnce();
	});

	it("removes a registered token after permission is revoked", async () => {
		setPushUser("did:plc:alice");
		mocks.getPermissions.mockResolvedValue({ granted: false });
		await removeCurrentPushDevice();
		expect(mocks.remove).toHaveBeenCalledWith(
			expect.objectContaining({ body: { token: "ExpoPushToken[known]" } }),
		);
		expect(mocks.getToken).not.toHaveBeenCalled();
	});

	it("does not register when sign-out overtakes token retrieval", async () => {
		setPushUser("did:plc:alice");
		let finishToken: (value: { data: string }) => void = () => {};
		mocks.getToken.mockReturnValue(
			new Promise((resolve) => {
				finishToken = resolve;
			}),
		);
		const syncing = syncAuthorizedPush();
		await vi.waitFor(() => expect(mocks.getToken).toHaveBeenCalled());
		await removeCurrentPushDevice();
		finishToken({ data: "ExpoPushToken[late]" });
		await syncing;
		expect(mocks.register).not.toHaveBeenCalled();
	});

	it("aborts a registration in flight before removing the device", async () => {
		setPushUser("did:plc:alice");
		mocks.register.mockImplementation(
			({ signal }: { signal: AbortSignal }) =>
				new Promise((_, reject) => {
					signal.addEventListener("abort", () => reject(new Error("aborted")));
				}),
		);
		const syncing = syncAuthorizedPush();
		await vi.waitFor(() => expect(mocks.register).toHaveBeenCalled());
		const removing = removeCurrentPushDevice();
		await expect(syncing).rejects.toThrow("aborted");
		await removing;
		expect(mocks.remove).toHaveBeenCalledWith(
			expect.objectContaining({ body: { token: "ExpoPushToken[known]" } }),
		);
	});
});
