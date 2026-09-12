import { generateKeyPairSync, verify } from "node:crypto";
import type { ConfigService } from "@nestjs/config";
import { AppleOAuthService } from "./apple-oauth.service";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
	namedCurve: "P-256",
});
const TEST_KEY_PEM = privateKey
	.export({ type: "pkcs8", format: "pem" })
	.toString();

const FULL_CONFIG: Record<string, string> = {
	APPLE_CLIENT_ID: "xyz.opnshelf.signin",
	APPLE_TEAM_ID: "FNW3B5Q58G",
	APPLE_KEY_ID: "ABC123DEFG",
	APPLE_PRIVATE_KEY: TEST_KEY_PEM,
	BACKEND_PUBLIC_URL: "https://api.opnshelf.xyz",
};

function service(overrides: Record<string, string | undefined> = {}) {
	const values = { ...FULL_CONFIG, ...overrides };
	return new AppleOAuthService({
		get: (key: string) => values[key],
	} as unknown as ConfigService);
}

/** Reach past `private` to assert on the secret Apple would receive. */
function mintClientSecret(svc: AppleOAuthService): string {
	return (svc as unknown as { clientSecret(): string }).clientSecret();
}

function decodeSegment(segment: string): Record<string, unknown> {
	return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

describe("AppleOAuthService", () => {
	describe("configured", () => {
		it("is configured when every Apple value is present", () => {
			expect(service().configured).toBe(true);
		});

		it.each([
			"APPLE_CLIENT_ID",
			"APPLE_TEAM_ID",
			"APPLE_KEY_ID",
			"APPLE_PRIVATE_KEY",
		])("is not configured without %s", (missing) => {
			expect(service({ [missing]: undefined }).configured).toBe(false);
		});
	});

	describe("buildAuthUrl", () => {
		it("asks for form_post, which is what makes the callback a cross-site POST", () => {
			const url = new URL(service().buildAuthUrl("signed-state"));
			expect(url.origin + url.pathname).toBe(
				"https://appleid.apple.com/auth/authorize",
			);
			expect(url.searchParams.get("response_mode")).toBe("form_post");
			expect(url.searchParams.get("scope")).toBe("name email");
			expect(url.searchParams.get("response_type")).toBe("code");
			expect(url.searchParams.get("state")).toBe("signed-state");
			expect(url.searchParams.get("client_id")).toBe("xyz.opnshelf.signin");
			expect(url.searchParams.get("redirect_uri")).toBe(
				"https://api.opnshelf.xyz/auth/apple/callback",
			);
		});

		it("refuses to build a URL when Apple is not configured", () => {
			expect(() =>
				service({ APPLE_CLIENT_ID: undefined }).buildAuthUrl("s"),
			).toThrow(/not configured/);
		});
	});

	describe("client secret", () => {
		it("signs an ES256 JWT Apple will accept", () => {
			const secret = mintClientSecret(service());
			const [headerSegment, claimsSegment, signature] = secret.split(".");

			expect(decodeSegment(headerSegment)).toEqual({
				alg: "ES256",
				kid: "ABC123DEFG",
				typ: "JWT",
			});

			const claims = decodeSegment(claimsSegment);
			expect(claims.iss).toBe("FNW3B5Q58G");
			expect(claims.sub).toBe("xyz.opnshelf.signin");
			expect(claims.aud).toBe("https://appleid.apple.com");

			// Apple caps the secret at six months and rejects anything longer.
			const lifetime = (claims.exp as number) - (claims.iat as number);
			expect(lifetime).toBeLessThan(6 * 30 * 24 * 60 * 60);
			expect(lifetime).toBeGreaterThan(0);

			// 64 raw bytes, not DER: the ieee-p1363 encoding JWS requires.
			expect(Buffer.from(signature, "base64url")).toHaveLength(64);
			const ok = verify(
				"sha256",
				Buffer.from(`${headerSegment}.${claimsSegment}`),
				{ key: publicKey, dsaEncoding: "ieee-p1363" },
				Buffer.from(signature, "base64url"),
			);
			expect(ok).toBe(true);
		});

		it("reuses a cached secret rather than re-signing", () => {
			const svc = service();
			expect(mintClientSecret(svc)).toBe(mintClientSecret(svc));
		});

		it("accepts a key whose newlines arrived escaped", () => {
			const escaped = TEST_KEY_PEM.replace(/\n/g, "\\n");
			const secret = mintClientSecret(service({ APPLE_PRIVATE_KEY: escaped }));
			const [header, claims, signature] = secret.split(".");
			const ok = verify(
				"sha256",
				Buffer.from(`${header}.${claims}`),
				{ key: publicKey, dsaEncoding: "ieee-p1363" },
				Buffer.from(signature, "base64url"),
			);
			expect(ok).toBe(true);
		});
	});
});
