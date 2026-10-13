// Disposable reference server, synthetic PLC/lexicon authority, real OAuth and DPoP.
import assert from "node:assert/strict";
import {
	createHash,
	generateKeyPairSync,
	randomBytes,
	randomUUID,
	sign,
} from "node:crypto";
import { request as httpRequest } from "node:http";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { root } from "./dev-session.mjs";

const image =
	"ghcr.io/bluesky-social/atproto@sha256:1cf9349e9f0e89789784569fed376cd647742ea7c368948625f44779ba03f150";
const base = "http://localhost:3213";
let authority = "did:plc:aaaaaaaaaaaaaaaaaaaaaaaa";
const directory = mkdtempSync(join(tmpdir(), "opnshelf-reference-"));
const container = `opnshelf-reference-${randomUUID()}`;
const resolverContainer = `${container}-resolver`;
const lexicons = new Map(
	readdirSync(join(root, "spaces/lexicons"))
		.filter((n) => n.endsWith(".json"))
		.map((n) => {
			const value = JSON.parse(readFileSync(join(root, "spaces/lexicons", n)));
			return [value.id, { ...value, $type: "com.atproto.lexicon.schema" }];
		}),
);
const core = JSON.parse(
	readFileSync(join(root, "lexicons/xyz/opnshelf/core.json")),
);
lexicons.set(core.id, { ...core, $type: "com.atproto.lexicon.schema" });
const { privateKey, publicKey } = generateKeyPairSync("ec", {
	namedCurve: "prime256v1",
});
const jwk = publicKey.export({ format: "jwk" });
const nonces = new Map();
function proof(url, method, token) {
	const encode = (value) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	const payload = {
		jti: randomUUID(),
		htm: method,
		htu: new URL(url).origin + new URL(url).pathname,
		iat: Math.floor(Date.now() / 1000),
		...(nonces.get(new URL(url).origin)
			? { nonce: nonces.get(new URL(url).origin) }
			: {}),
		...(token
			? { ath: createHash("sha256").update(token).digest("base64url") }
			: {}),
	};
	const input = `${encode({ typ: "dpop+jwt", alg: "ES256", jwk })}.${encode(payload)}`;
	return `${input}.${sign("sha256", Buffer.from(input), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}
async function dpop(url, options = {}, token) {
	for (let attempt = 0; attempt < 3; attempt++) {
		const response = await fetch(url, {
			...options,
			signal: AbortSignal.timeout(15000),
			headers: {
				...options.headers,
				DPoP: proof(url, options.method || "GET", token),
				...(token ? { authorization: `DPoP ${token}` } : {}),
			},
		});
		const nonce = response.headers.get("dpop-nonce");
		if (nonce) nonces.set(new URL(url).origin, nonce);
		if (
			(response.status === 400 || response.status === 401) &&
			nonce &&
			attempt < 2
		)
			continue;
		return response;
	}
}
async function json(response, label) {
	const value = await response.json();
	assert(
		response.ok,
		`${label}: HTTP ${response.status} ${value.error ?? ""} ${value.error_description ?? ""}`,
	);
	return value;
}
const scope = execFileSync(
	"pnpm",
	[
		"--filter",
		"backend",
		"exec",
		"ts-node",
		"--transpile-only",
		"scripts/privacy-reference-smoke.ts",
		"--scope",
	],
	{
		cwd: root,
		encoding: "utf8",
		env: {
			...process.env,
			NODE_ENV: "test",
			DATABASE_URL: "postgresql://localhost:5432/opnshelf_codegen",
		},
		stdio: ["ignore", "pipe", "inherit"],
	},
).trim();
const callback = "http://127.0.0.1:3215/callback";
const clientId = `http://localhost?${new URLSearchParams({ redirect_uri: callback, scope })}`;
const cookies = new Map();
function remember(response) {
	for (const cookie of response.headers.getSetCookie()) {
		const [name, ...value] = cookie.split(";")[0].split("=");
		cookies.set(name, value.join("="));
	}
}
function browserRequest(url, options = {}) {
	return new Promise((resolve, reject) => {
		const request = httpRequest(
			url,
			{ method: options.method || "GET", headers: options.headers },
			(response) => {
				const chunks = [];
				response.on("data", (chunk) => chunks.push(chunk));
				response.on("end", () => {
					const headers = new Headers();
					for (const [name, values] of Object.entries(response.headers))
						for (const value of [].concat(values || []))
							headers.append(name, value);
					resolve(
						new Response(Buffer.concat(chunks), {
							status: response.statusCode,
							headers,
						}),
					);
				});
			},
		);
		request.setTimeout(15000, () =>
			request.destroy(new Error("Synthetic browser request timed out")),
		);
		request.on("error", reject);
		request.end(options.body);
	});
}
async function authorize(account, reject = false) {
	const verifier = randomBytes(32).toString("base64url");
	const par = await json(
		await dpop(`${base}/oauth/par`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId,
				redirect_uri: callback,
				response_type: "code",
				scope,
				state: randomUUID(),
				code_challenge_method: "S256",
				code_challenge: createHash("sha256")
					.update(verifier)
					.digest("base64url"),
			}),
		}),
		"PAR",
	);
	const page = `${base}/oauth/authorize?${new URLSearchParams({ client_id: clientId, request_uri: par.request_uri })}`;
	const response = await browserRequest(page, {
		signal: AbortSignal.timeout(15000),
		headers: {
			"sec-fetch-site": "none",
			"sec-fetch-mode": "navigate",
			"sec-fetch-dest": "document",
			cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
		},
	});
	remember(response);
	const pageText = await response.text();
	if (response.status !== 200) {
		const match = pageText.match(/error_description[^<]{0,400}/);
		console.error(match?.[0] || pageText.replace(/<[^>]+>/g, "").slice(-1200));
	}
	assert.equal(
		response.status,
		200,
		"Reference consent page must resolve declarations",
	);
	async function api(endpoint, body, token) {
		const response = await browserRequest(
			`${base}/@atproto/oauth-provider/~api/${endpoint}`,
			{
				method: "POST",
				signal: AbortSignal.timeout(15000),
				headers: {
					"content-type": "application/json",
					origin: base,
					referer: page,
					"sec-fetch-mode": "same-origin",
					"sec-fetch-site": "same-origin",
					"x-csrf-token": cookies.get("csrf-token"),
					cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
					...(token ? { authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify(body),
			},
		);
		remember(response);
		return json(response, endpoint);
	}
	const login = await api("sign-in", {
		username: account.handle,
		password: account.password,
		remember: false,
		locale: "en",
	});
	const result = await api(
		reject ? "reject" : "consent",
		reject ? {} : { did: account.did },
		login.ephemeralToken,
	);
	const intermediate = new URL(result.url);
	assert.equal(intermediate.origin, base);
	const redirect = new URL(intermediate.searchParams.get("redirect_uri"));
	for (const key of ["code", "error", "error_description", "state", "iss"])
		if (intermediate.searchParams.has(key))
			redirect.searchParams.set(key, intermediate.searchParams.get(key));
	assert.equal(redirect.origin, new URL(callback).origin);
	if (reject) {
		assert.equal(redirect.searchParams.get("error"), "access_denied");
		console.log("PASS reference OAuth declined consent");
		return;
	}
	assert(
		redirect.searchParams.get("code"),
		"Reference must return authorization code",
	);
	const token = await json(
		await dpop(`${base}/oauth/token`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId,
				grant_type: "authorization_code",
				code: redirect.searchParams.get("code"),
				redirect_uri: callback,
				code_verifier: verifier,
			}),
		}),
		"PKCE exchange",
	);
	assert.equal(token.token_type.toLowerCase(), "dpop");
	assert.equal(token.sub, account.did);
	console.log("PASS reference OAuth PAR, declarations, consent, PKCE and DPoP");
	return token;
}
let cleaned = false;
function cleanup() {
	if (cleaned) return;
	cleaned = true;
	try {
		execFileSync("docker", ["rm", "-f", container], {
			stdio: "ignore",
			timeout: 20000,
		});
	} catch {}
	try {
		execFileSync("docker", ["rm", "-f", resolverContainer], {
			stdio: "ignore",
			timeout: 20000,
		});
	} catch {}
	rmSync(directory, { recursive: true, force: true });
}
process.on("SIGINT", () => {
	cleanup();
	process.exit(130);
});
process.on("SIGTERM", () => {
	cleanup();
	process.exit(143);
});
async function startPds() {
	execFileSync(
		"docker",
		[
			"run",
			"-d",
			"--platform",
			"linux/amd64",
			"--name",
			container,
			// Bind-mounted data stays private and writable by the host runner on Linux.
			"--user",
			`${process.getuid()}:${process.getgid()}`,
			"--network",
			`container:${resolverContainer}`,
			"--mount",
			`type=bind,src=${directory},dst=/pds`,
			"-e",
			"PDS_DEV_MODE=true",
			"-e",
			"PDS_HOSTNAME=localhost",
			"-e",
			"PDS_PORT=3213",
			"-e",
			"PDS_DATA_DIRECTORY=/pds",
			"-e",
			"PDS_BLOBSTORE_DISK_LOCATION=/pds/blobs",
			"-e",
			"PDS_DID_PLC_URL=http://localhost:3214",
			"-e",
			`PDS_LEXICON_AUTHORITY_DID=${authority}`,
			"-e",
			"PDS_SERVICE_HANDLE_DOMAINS=.test",
			"-e",
			"PDS_INVITE_REQUIRED=false",
			"-e",
			"PDS_RATE_LIMITS_ENABLED=false",
			"-e",
			`PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX=${randomBytes(32).toString("hex")}`,
			"-e",
			`PDS_JWT_SECRET=${randomBytes(32).toString("hex")}`,
			"-e",
			`PDS_ADMIN_PASSWORD=${randomBytes(24).toString("hex")}`,
			image,
		],
		{ stdio: "ignore", timeout: 60000 },
	);
	let ready = false;
	for (let i = 0; i < 60; i++) {
		try {
			ready = (
				await fetch(`${base}/xrpc/_health`, {
					signal: AbortSignal.timeout(1000),
				})
			).ok;
		} catch {}
		if (ready) break;
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	assert(ready, "Disposable reference PDS did not become ready");
}
try {
	// PDS and resolver share an isolated namespace; only PDS is published on host loopback.
	execFileSync(
		"docker",
		[
			"run",
			"-d",
			"--platform",
			"linux/amd64",
			"--name",
			resolverContainer,
			"-p",
			"127.0.0.1:3213:3213",
			"--mount",
			`type=bind,src=${join(root, "scripts/reference-plc.mjs")},dst=/fixture-plc.mjs,readonly`,
			"--entrypoint",
			"node",
			image,
			"/fixture-plc.mjs",
		],
		{ stdio: "ignore", timeout: 60000 },
	);
	await startPds();
	const publisherPassword = randomBytes(24).toString("base64url");
	const publisher = await json(
		await fetch(`${base}/xrpc/com.atproto.server.createAccount`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				handle: "publisher.test",
				email: "publisher@example.com",
				password: publisherPassword,
			}),
			signal: AbortSignal.timeout(15000),
		}),
		"synthetic publisher",
	);
	authority = publisher.did;
	for (const record of lexicons.values()) {
		await json(
			await fetch(`${base}/xrpc/com.atproto.repo.putRecord`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${publisher.accessJwt}`,
				},
				body: JSON.stringify({
					repo: authority,
					collection: "com.atproto.lexicon.schema",
					rkey: record.id,
					record,
					validate: false,
				}),
				signal: AbortSignal.timeout(15000),
			}),
			"local declaration publication",
		);
	}
	execFileSync("docker", ["rm", "-f", container], {
		stdio: "ignore",
		timeout: 20000,
	});
	await startPds();
	const password = randomBytes(24).toString("base64url");
	const account = await json(
		await fetch(`${base}/xrpc/com.atproto.server.createAccount`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				handle: `p${randomBytes(5).toString("hex")}.test`,
				email: `${randomUUID()}@example.com`,
				password,
			}),
			signal: AbortSignal.timeout(15000),
		}),
		"synthetic account",
	);
	account.password = password;
	await authorize(account, true);
	const token = await authorize(account);
	const child = spawn(
		"pnpm",
		[
			"--filter",
			"backend",
			"exec",
			"ts-node",
			"--transpile-only",
			"scripts/privacy-reference-smoke.ts",
		],
		{
			cwd: root,
			env: {
				...process.env,
				NODE_ENV: "test",
				DATABASE_URL: "postgresql://localhost:5432/opnshelf_codegen",
				PRIVACY_REFERENCE_PDS_URL: base,
				PRIVACY_REFERENCE_SESSION_STDIN: "1",
			},
			stdio: ["pipe", "inherit", "inherit"],
		},
	);
	// The signing key and synthetic token are passed only over stdin, never argv/logs.
	child.stdin.end(
		JSON.stringify({
			...token,
			privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
		}),
	);
	const code = await new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("exit", resolve);
	});
	assert.equal(code, 0, "Reference record round trips");
} finally {
	cleanup();
}
