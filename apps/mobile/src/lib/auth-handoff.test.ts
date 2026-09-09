import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { beginHandoff, clearHandoff, redeemHandoffCode } from "./auth-handoff";

const mocks = vi.hoisted(() => ({
	challenge: vi.fn(),
	exchange: vi.fn(),
}));

vi.mock("@opnshelf/api", () => ({
	authControllerMobileChallenge: mocks.challenge,
	authControllerMobileExchange: mocks.exchange,
}));

vi.mock("expo-secure-store", () => ({
	getItemAsync: vi.fn(),
	setItemAsync: vi.fn(),
	deleteItemAsync: vi.fn(),
}));

const VERIFIER_KEY = "opnshelf_auth_code_verifier";

beforeEach(async () => {
	vi.clearAllMocks();
	vi.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
	vi.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
	vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
	await clearHandoff();
});

describe("beginHandoff", () => {
	it("returns the challenge and keeps the verifier out of the return value", async () => {
		mocks.challenge.mockResolvedValue({
			data: { codeVerifier: "verifier", codeChallenge: "challenge" },
		});

		await expect(beginHandoff()).resolves.toBe("challenge");
		expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
			VERIFIER_KEY,
			"verifier",
		);
	});

	it("falls back to the legacy flow when the backend has no challenge endpoint", async () => {
		mocks.challenge.mockRejectedValue({ status: 404 });
		vi.spyOn(console, "warn").mockImplementation(() => {});

		await expect(beginHandoff()).resolves.toBeNull();
		expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
		expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(VERIFIER_KEY);
	});
});

describe("redeemHandoffCode", () => {
	it("exchanges the code with the in-memory verifier and clears it", async () => {
		mocks.challenge.mockResolvedValue({
			data: { codeVerifier: "verifier", codeChallenge: "challenge" },
		});
		mocks.exchange.mockResolvedValue({ data: { sessionId: "session-123" } });
		await beginHandoff();

		await expect(redeemHandoffCode("handoff-code")).resolves.toBe(
			"session-123",
		);
		expect(mocks.exchange).toHaveBeenCalledWith({
			body: { code: "handoff-code", codeVerifier: "verifier" },
			throwOnError: true,
		});
		expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(VERIFIER_KEY);
		// The verifier is single-use on this side too.
		await expect(redeemHandoffCode("handoff-code")).rejects.toThrow(
			"No pending sign-in to complete",
		);
	});

	it("reads the verifier from SecureStore when the process was restarted", async () => {
		vi.mocked(SecureStore.getItemAsync).mockResolvedValue("stored-verifier");
		mocks.exchange.mockResolvedValue({ data: { sessionId: "session-456" } });

		await expect(redeemHandoffCode("handoff-code")).resolves.toBe(
			"session-456",
		);
		expect(mocks.exchange).toHaveBeenCalledWith({
			body: { code: "handoff-code", codeVerifier: "stored-verifier" },
			throwOnError: true,
		});
	});

	it("clears the verifier even when the exchange is rejected", async () => {
		vi.mocked(SecureStore.getItemAsync).mockResolvedValue("stored-verifier");
		mocks.exchange.mockRejectedValue({ status: 400 });

		await expect(redeemHandoffCode("handoff-code")).rejects.toEqual({
			status: 400,
		});
		expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(VERIFIER_KEY);
	});
});
