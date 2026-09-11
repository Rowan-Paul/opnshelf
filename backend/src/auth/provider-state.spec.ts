import {
	PROVIDER_STATE_TTL_MS,
	signProviderState,
	verifyProviderState,
} from "./provider-state";

const SECRET = "test-provider-state-secret";

describe("provider state", () => {
	it("accepts a state it just minted", () => {
		const payload = verifyProviderState(SECRET, signProviderState(SECRET));
		expect(payload).not.toBeNull();
		expect(typeof payload?.nonce).toBe("string");
	});

	it("mints a different state every time", () => {
		expect(signProviderState(SECRET)).not.toEqual(signProviderState(SECRET));
	});

	it("rejects a state signed with a different secret", () => {
		const state = signProviderState("some-other-secret");
		expect(verifyProviderState(SECRET, state)).toBeNull();
	});

	it("rejects a tampered payload", () => {
		const state = signProviderState(SECRET);
		const [body, signature] = state.split(".");
		const forged = Buffer.from(
			JSON.stringify({ nonce: "attacker", issuedAt: Date.now() }),
		).toString("base64url");
		expect(body).not.toEqual(forged);
		expect(verifyProviderState(SECRET, `${forged}.${signature}`)).toBeNull();
	});

	it("rejects a state past its TTL", () => {
		const state = signProviderState(SECRET);
		const justAfter = Date.now() + PROVIDER_STATE_TTL_MS + 1000;
		expect(verifyProviderState(SECRET, state, justAfter)).toBeNull();
	});

	it("accepts a state just inside its TTL", () => {
		const state = signProviderState(SECRET);
		const justBefore = Date.now() + PROVIDER_STATE_TTL_MS - 1000;
		expect(verifyProviderState(SECRET, state, justBefore)).not.toBeNull();
	});

	it("rejects a state stamped in the future", () => {
		const state = signProviderState(SECRET);
		expect(verifyProviderState(SECRET, state, Date.now() - 60_000)).toBeNull();
	});

	it.each([
		["undefined", undefined],
		["empty", ""],
		["no separator", "justonesegment"],
		["empty body", ".signature"],
		["not base64url json", "!!!!.$$$$"],
	])("rejects a malformed state (%s)", (_label, state) => {
		expect(verifyProviderState(SECRET, state as string | undefined)).toBeNull();
	});
});
