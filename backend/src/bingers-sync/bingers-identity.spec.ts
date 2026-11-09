import { afterEach, expect, it, vi } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { parseEnvironment } from "../config/env.schema";
import { BingersSyncClient } from "./bingers-sync.client";
afterEach(() => vi.unstubAllGlobals());
it("verifies signed OpenID identity with issuer, client audience, expiry and nonce", async () => {
	const client = new BingersSyncClient(
		parseEnvironment({
			NODE_ENV: "test",
			BACKEND_PUBLIC_URL: "https://api.example.test",
		}),
	);
	const { publicKey, privateKey } = await generateKeyPair("EdDSA");
	client["jwks"] = createLocalJWKSet({ keys: [await exportJWK(publicKey)] });
	const sign = (claims: Record<string, unknown> = {}) =>
		new SignJWT({ nonce: "fixture-state", name: "Fixture", ...claims })
			.setProtectedHeader({ alg: "EdDSA" })
			.setSubject("fixture-account")
			.setIssuer("https://api.bingers.app")
			.setAudience(
				typeof claims.aud === "string" ? claims.aud : client.clientId,
			)
			.setIssuedAt()
			.setExpirationTime("5m")
			.sign(privateKey);
	const fetcher = vi.fn();
	vi.stubGlobal("fetch", fetcher);
	expect(await client.profile(await sign(), "fixture-state")).toEqual({
		sub: "fixture-account",
		name: "Fixture",
	});
	await expect(
		client.profile(await sign({ nonce: "other-state" }), "fixture-state"),
	).rejects.toThrow("did not match");
	await expect(
		client.profile(
			await sign({ aud: "https://api.bingers.app/v1" }),
			"fixture-state",
		),
	).rejects.toThrow();
	const invalidIssuer = new SignJWT({ nonce: "fixture-state" })
		.setProtectedHeader({ alg: "EdDSA" })
		.setSubject("fixture-account")
		.setIssuer("https://wrong.example")
		.setAudience(client.clientId)
		.setIssuedAt()
		.setExpirationTime("5m");
	await expect(
		client.profile(await invalidIssuer.sign(privateKey), "fixture-state"),
	).rejects.toThrow();
	await expect(client.profile(undefined, "fixture-state")).rejects.toThrow(
		"OpenID identity",
	);
	expect(fetcher).not.toHaveBeenCalled();
});
