import {
	computeCodeChallenge,
	isValidCodeChallenge,
	parseOAuthAppState,
	serializeOAuthAppState,
} from "./oauth-app-state";

describe("oauth-app-state", () => {
	describe("parseOAuthAppState", () => {
		it("should parse valid state payload", () => {
			expect(
				parseOAuthAppState('{"platform":"mobile","timezone":"Europe/London"}'),
			).toEqual({
				platform: "mobile",
				timezone: "Europe/London",
			});
		});

		it("should return empty state for invalid payload", () => {
			expect(parseOAuthAppState("not-json")).toEqual({});
		});

		it("keeps a well-formed code challenge and drops a malformed one", () => {
			const challenge = "A".repeat(43);
			expect(
				parseOAuthAppState(
					JSON.stringify({ platform: "mobile", codeChallenge: challenge }),
				).codeChallenge,
			).toBe(challenge);
			expect(
				parseOAuthAppState(
					JSON.stringify({ platform: "mobile", codeChallenge: "short" }),
				).codeChallenge,
			).toBeUndefined();
		});
	});

	describe("serializeOAuthAppState", () => {
		it("sends no state when nothing needs carrying", () => {
			expect(serializeOAuthAppState(undefined)).toBeUndefined();
			expect(serializeOAuthAppState({})).toBeUndefined();
			expect(serializeOAuthAppState({ timezone: "   " })).toBeUndefined();
			// Account identity alone is not a reason to send state.
			expect(
				serializeOAuthAppState({ accountDid: "did:plc:abc123" }),
			).toBeUndefined();
		});

		it("keeps only well-formed fields and round-trips through parse", () => {
			const challenge = "A".repeat(43);
			const raw = serializeOAuthAppState({
				platform: "mobile",
				timezone: "Europe/London",
				permissionChange: "blog",
				requestedPreferences: { blogEnabled: true },
				accountDid: "did:plc:abc123",
				accountHandle: "reader.example",
				codeChallenge: challenge,
			});

			expect(parseOAuthAppState(raw)).toEqual({
				platform: "mobile",
				timezone: "Europe/London",
				permissionChange: "blog",
				requestedPreferences: { blogEnabled: true },
				accountDid: "did:plc:abc123",
				accountHandle: "reader.example",
				codeChallenge: challenge,
			});
		});

		it("drops a malformed code challenge instead of carrying it", () => {
			expect(
				JSON.parse(
					serializeOAuthAppState({
						platform: "mobile",
						codeChallenge: "short",
					}) as string,
				),
			).toEqual({ platform: "mobile" });
		});
	});

	describe("code challenge helpers", () => {
		it("accepts exactly 43 base64url characters", () => {
			expect(isValidCodeChallenge("A".repeat(43))).toBe(true);
			expect(isValidCodeChallenge("A".repeat(42))).toBe(false);
			expect(isValidCodeChallenge(`${"A".repeat(42)}=`)).toBe(false);
			expect(isValidCodeChallenge(42)).toBe(false);
		});

		it("computes S256 as base64url(sha256(ascii(verifier)))", () => {
			// RFC 7636 appendix B test vector.
			expect(
				computeCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
			).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
		});
	});
});
