import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	beginHandoff,
	clearHandoff,
	NoPendingHandoffError,
	redeemHandoffCode,
} from "./auth-handoff";

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
		// Single-use on this side too, and typed so callers can tell it from a
		// real failure.
		await expect(redeemHandoffCode("handoff-code")).rejects.toBeInstanceOf(
			NoPendingHandoffError,
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

	it("shares one exchange between two callers redeeming the same code", async () => {
		// Android's double delivery: the auth session and the auth/complete route
		// both redeem. Two exchanges would mean the backend consumes the code for
		// one of them and rejects the other with a plain HTTP error, which no
		// caller recognises as "someone else finished it".
		vi.mocked(SecureStore.getItemAsync).mockResolvedValue("stored-verifier");
		let release!: (value: { data: { sessionId: string } }) => void;
		mocks.exchange.mockReturnValue(
			new Promise((resolve) => {
				release = resolve;
			}),
		);

		const first = redeemHandoffCode("handoff-code");
		const second = redeemHandoffCode("handoff-code");
		release({ data: { sessionId: "session-789" } });

		await expect(Promise.all([first, second])).resolves.toEqual([
			"session-789",
			"session-789",
		]);
		expect(mocks.exchange).toHaveBeenCalledTimes(1);
	});

	it("still rejects a second redemption once the first has finished", async () => {
		// Only overlapping calls share; a late arrival for a spent code must get
		// the typed error, because by then there really is nothing to redeem.
		vi.mocked(SecureStore.getItemAsync).mockResolvedValue("stored-verifier");
		mocks.exchange.mockResolvedValue({ data: { sessionId: "session-789" } });

		await redeemHandoffCode("handoff-code");
		vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);

		await expect(redeemHandoffCode("handoff-code")).rejects.toBeInstanceOf(
			NoPendingHandoffError,
		);
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
