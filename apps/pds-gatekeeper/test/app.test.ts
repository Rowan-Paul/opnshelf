import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../src/app.js";
import type { GatekeeperConfig } from "../src/config.js";
import { GateCodeStore } from "../src/store.js";

function createConfig(dbDir: string): GatekeeperConfig {
	return {
		host: "127.0.0.1",
		port: 8080,
		pdsBaseUrl: "http://pds-origin.railway.internal:3000",
		pdsHostname: "example.com",
		enableSignupProtection: true,
		signupCodeTtlSeconds: 300,
		turnstileSiteKey: "site-key",
		turnstileSecretKey: "secret-key",
		turnstileExpectedHostname: "example.com",
		turnstileExpectedAction: "signup",
		defaultCaptchaRedirect: "https://bsky.app",
		allowedCaptchaRedirects: ["https://bsky.app", "https://app.example.com"],
		dbPath: join(dbDir, "gatekeeper.sqlite"),
	};
}

test("describeServer advertises signup protection", async () => {
	const workDir = mkdtempSync(join(tmpdir(), "gatekeeper-test-"));
	const config = createConfig(workDir);
	const app = await createApp({
		config,
		fetchImpl: async () =>
			new Response(
				JSON.stringify({
					availableUserDomains: ["example.com"],
				}),
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
				},
			),
	});

	try {
		const response = await app.inject({
			method: "GET",
			url: "/xrpc/com.atproto.server.describeServer",
		});
		assert.equal(response.statusCode, 200);
		assert.deepEqual(response.json(), {
			availableUserDomains: ["example.com"],
			phoneVerificationRequired: true,
		});
	} finally {
		await app.close();
		rmSync(workDir, { force: true, recursive: true });
	}
});

test("createAccount rejects missing verification codes", async () => {
	const workDir = mkdtempSync(join(tmpdir(), "gatekeeper-test-"));
	const config = createConfig(workDir);
	const app = await createApp({
		config,
		fetchImpl: async () =>
			new Response("{}", {
				status: 200,
				headers: {
					"content-type": "application/json",
				},
			}),
	});

	try {
		const response = await app.inject({
			method: "POST",
			url: "/xrpc/com.atproto.server.createAccount",
			payload: {
				handle: "alice.example.com",
			},
		});
		assert.equal(response.statusCode, 400);
		assert.deepEqual(response.json(), {
			error: "InvalidRequest",
			message: "Verification is required on this server.",
		});
	} finally {
		await app.close();
		rmSync(workDir, { force: true, recursive: true });
	}
});

test("createAccount accepts a valid single-use code", async () => {
	const workDir = mkdtempSync(join(tmpdir(), "gatekeeper-test-"));
	const config = createConfig(workDir);
	let issuedCode = "";

	const app = await createApp({
		config,
		fetchImpl: async (input, init) => {
			const url = input instanceof Request ? input.url : String(input);
			if (url.includes("siteverify")) {
				return new Response(
					JSON.stringify({
						success: true,
						action: "signup",
						hostname: "example.com",
					}),
					{
						status: 200,
						headers: {
							"content-type": "application/json",
						},
					},
				);
			}

			const payload = JSON.parse(String(init?.body ?? "{}")) as {
				verificationCode?: string;
			};
			assert.equal(payload.verificationCode, issuedCode);
			return new Response(JSON.stringify({ did: "did:plc:alice" }), {
				status: 200,
				headers: {
					"content-type": "application/json",
				},
			});
		},
	});

	try {
		const gateResponse = await app.inject({
			method: "POST",
			url: "/gate/signup?handle=alice.example.com&state=opaque&redirect_url=https%3A%2F%2Fapp.example.com",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				"cf-connecting-ip": "203.0.113.10",
			},
			payload: "cf-turnstile-response=token-value&redirect_url=https%3A%2F%2Fapp.example.com",
		});

		assert.equal(gateResponse.statusCode, 302);
		const location = gateResponse.headers.location;
		assert.ok(location);
		const redirect = new URL(location);
		issuedCode = redirect.searchParams.get("code") ?? "";
		assert.ok(issuedCode);

		const createResponse = await app.inject({
			method: "POST",
			url: "/xrpc/com.atproto.server.createAccount",
			payload: {
				handle: "alice.example.com",
				verificationCode: issuedCode,
			},
		});

		assert.equal(createResponse.statusCode, 200);
		assert.deepEqual(createResponse.json(), { did: "did:plc:alice" });

		const replayResponse = await app.inject({
			method: "POST",
			url: "/xrpc/com.atproto.server.createAccount",
			payload: {
				handle: "alice.example.com",
				verificationCode: issuedCode,
			},
		});

		assert.equal(replayResponse.statusCode, 400);
		assert.deepEqual(replayResponse.json(), {
			error: "InvalidToken",
			message: "Token could not be verified",
		});
	} finally {
		await app.close();
		rmSync(workDir, { force: true, recursive: true });
	}
});

test("issued codes expire after the configured ttl", async () => {
	const workDir = mkdtempSync(join(tmpdir(), "gatekeeper-test-"));
	const config = createConfig(workDir);
	const store = await GateCodeStore.open(config);

	try {
		const code = store.issueCode("alice.example.com", 0);
		const result = store.consumeCode("alice.example.com", code, 300, 301_000);
		assert.deepEqual(result, { ok: false, reason: "expired" });
	} finally {
		store.close();
		rmSync(workDir, { force: true, recursive: true });
	}
});
