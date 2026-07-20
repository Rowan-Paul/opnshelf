import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSessionToken, saveSessionToken } from "./api";

const { setSessionTokenMock } = vi.hoisted(() => ({
	setSessionTokenMock: vi.fn(),
}));

vi.mock("@opnshelf/api", () => ({
	configureApiClient: vi.fn(),
	setSessionToken: setSessionTokenMock,
}));

vi.mock("expo-secure-store", () => ({
	getItemAsync: vi.fn(),
	setItemAsync: vi.fn(),
	deleteItemAsync: vi.fn(),
}));

vi.mock("./env", () => ({ env: { apiUrl: "https://api.test.invalid" } }));

const testSession = "test-session";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("loadSessionToken", () => {
	it("applies a present persisted session", async () => {
		vi.mocked(SecureStore.getItemAsync).mockResolvedValue(testSession);

		const result = await loadSessionToken();

		expect(result).toBe(testSession);
		expect(setSessionTokenMock).toHaveBeenCalledWith(result);
	});

	it("clears stale in-memory state when storage is empty", async () => {
		vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);

		await expect(loadSessionToken()).resolves.toBeNull();
		expect(setSessionTokenMock).toHaveBeenCalledWith(null);
	});

	it("clears in-memory state and rejects when storage cannot be read", async () => {
		const storageError = new Error("test read failure");
		vi.mocked(SecureStore.getItemAsync).mockRejectedValue(storageError);

		await expect(loadSessionToken()).rejects.toBe(storageError);
		expect(setSessionTokenMock).toHaveBeenCalledWith(null);
	});
});

describe("saveSessionToken", () => {
	it("persists a session before applying it in memory", async () => {
		vi.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);

		await saveSessionToken(testSession);

		expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
			"opnshelf_session_token",
			testSession,
		);
		expect(setSessionTokenMock).toHaveBeenCalledWith(testSession);
		expect(
			vi.mocked(SecureStore.setItemAsync).mock.invocationCallOrder[0],
		).toBeLessThan(setSessionTokenMock.mock.invocationCallOrder[0]);
	});

	it("rejects a failed write without changing in-memory state", async () => {
		const storageError = new Error("test write failure");
		vi.mocked(SecureStore.setItemAsync).mockRejectedValue(storageError);

		await expect(saveSessionToken(testSession)).rejects.toBe(storageError);
		expect(setSessionTokenMock).not.toHaveBeenCalled();
	});

	it("deletes a session before clearing it in memory", async () => {
		vi.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);

		await saveSessionToken(null);

		expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
			"opnshelf_session_token",
		);
		expect(setSessionTokenMock).toHaveBeenCalledWith(null);
		expect(
			vi.mocked(SecureStore.deleteItemAsync).mock.invocationCallOrder[0],
		).toBeLessThan(setSessionTokenMock.mock.invocationCallOrder[0]);
	});

	it("rejects a failed delete without changing in-memory state", async () => {
		const storageError = new Error("test delete failure");
		vi.mocked(SecureStore.deleteItemAsync).mockRejectedValue(storageError);

		await expect(saveSessionToken(null)).rejects.toBe(storageError);
		expect(setSessionTokenMock).not.toHaveBeenCalled();
	});
});
