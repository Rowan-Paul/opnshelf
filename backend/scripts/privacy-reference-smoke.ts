/** Run only against a disposable reference Spaces PDS with local PLC.
 * Account passwords and bearer tokens are generated/consumed in memory and never logged.
 * This checks wire compatibility, not the separate OAuth browser consent flow. */
import assert from "node:assert/strict";
import {
	createHash,
	createPrivateKey,
	createPublicKey,
	randomBytes,
	randomUUID,
	sign,
} from "node:crypto";
import {
	buildOAuthScope,
	includesOAuthCapabilities,
	includesWatchSpaceGrant,
} from "../src/auth/oauth-scopes";
import { WatchMigrationPds } from "../src/privacy/watch-migration-pds";
import {
	PRIVACY_CATEGORIES,
	privacyRepositoryConfig,
} from "../src/privacy/privacy-category";
import {
	createWatchAgent,
	watchOperation,
} from "../src/privacy/watch-operation";

async function main() {
	const base = process.env.PRIVACY_REFERENCE_PDS_URL ?? "http://127.0.0.1:3203";
	assert(
		["127.0.0.1", "localhost"].includes(new URL(base).hostname),
		"Disposable local PDS only",
	);
	let account: { did: string; accessJwt?: string };
	let oauth:
		| { sub: string; access_token: string; scope: string; privateKey: string }
		| undefined;
	if (process.env.PRIVACY_REFERENCE_SESSION_STDIN === "1") {
		const chunks: Buffer[] = [];
		for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
		oauth = JSON.parse(Buffer.concat(chunks).toString());
		assert(
			oauth &&
				typeof oauth.sub === "string" &&
				typeof oauth.access_token === "string" &&
				typeof oauth.privateKey === "string",
		);
		account = { did: oauth.sub };
	} else {
		const create = await fetch(
			`${base}/xrpc/com.atproto.server.createAccount`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					handle: `p${randomBytes(5).toString("hex")}.test`,
					email: `privacy-${Date.now()}@example.com`,
					password: randomBytes(24).toString("base64url"),
				}),
				signal: AbortSignal.timeout(15000),
			},
		);
		account = await create.json();
		assert(
			create.ok &&
				typeof account.did === "string" &&
				typeof account.accessJwt === "string",
			`Synthetic account creation failed: ${create.status}`,
		);
	}
	const did = account.did;
	if (oauth)
		assert(
			includesOAuthCapabilities(
				oauth.scope,
				{ watchPrivacyEnabled: true },
				did,
			),
			"Reference token must satisfy the app callback capability check",
		);
	const key = oauth ? createPrivateKey(oauth.privateKey) : undefined;
	const jwk = key ? createPublicKey(key).export({ format: "jwk" }) : undefined;
	let nonce: string | undefined;
	const authenticatedFetch = async (path: string, init?: RequestInit) => {
		const url = new URL(path, base);
		for (let attempt = 0; attempt < 3; attempt++) {
			const headers = new Headers(init?.headers);
			if (oauth && key && jwk) {
				const encode = (value: unknown) =>
					Buffer.from(JSON.stringify(value)).toString("base64url");
				const input = `${encode({ typ: "dpop+jwt", alg: "ES256", jwk })}.${encode({ jti: randomUUID(), htm: init?.method ?? "GET", htu: url.origin + url.pathname, iat: Math.floor(Date.now() / 1000), ath: createHash("sha256").update(oauth.access_token).digest("base64url"), ...(nonce ? { nonce } : {}) })}`;
				headers.set(
					"DPoP",
					`${input}.${sign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`,
				);
				headers.set("authorization", `DPoP ${oauth.access_token}`);
			} else headers.set("authorization", `Bearer ${account.accessJwt}`);
			const response = await fetch(url, {
				...init,
				headers,
				signal: init?.signal ?? AbortSignal.timeout(15000),
			});
			const nextNonce = response.headers.get("dpop-nonce");
			if (nextNonce) nonce = nextNonce;
			if (
				(response.status === 400 || response.status === 401) &&
				nextNonce &&
				attempt < 2
			)
				continue;
			return response;
		}
		throw new Error("Reference DPoP retry limit exceeded");
	};
	for (const category of PRIVACY_CATEGORIES) {
		const config = privacyRepositoryConfig(
			category,
			category === "lists" ? "smoke-list" : undefined,
		);
		if (oauth)
			assert(
				includesWatchSpaceGrant(oauth.scope, config.scope, did),
				`Missing reference grant for ${category}`,
			);
		const session = {
			did,
			getTokenInfo: async () => ({ scope: oauth?.scope ?? config.scope }),
			fetchHandler: authenticatedFetch,
		};
		const pds = new WatchMigrationPds(did, session, undefined, config);
		await pds.assertPrivate();
		for (const collection of config.collections) {
			const ref = { collection, rkey: "3mxclabc36s2i" };
			const value = {
				$type: collection,
				test: "disposable",
				extension: { preserve: true },
			};
			const result = await session.fetchHandler(
				"/xrpc/com.atproto.repo.putRecord",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						repo: did,
						...ref,
						record: value,
						validate: false,
					}),
				},
			);
			assert(result.ok, `Public seed failed: ${result.status}`);
			const source = await pds.readPublic(ref);
			assert(source);
			await pds.createPrivate(ref, source);
			assert.deepEqual(await pds.readPrivate(ref), source);
			await pds.deletePublic(ref, source.cid);
			assert.equal(await pds.readPublic(ref), undefined);
			const page = await pds.list(collection, true);
			assert(
				page.records.some(
					(record) => record.rkey === ref.rkey && record.cid === source.cid,
				),
			);
			await watchOperation.run(
				{
					did,
					visibility: "private",
					signal: AbortSignal.timeout(30000),
					repository: config,
				},
				async () => {
					const agent = createWatchAgent(session);
					const updated = { ...value, test: "updated" };
					const put = await agent.com.atproto.repo.putRecord({
						repo: did,
						...ref,
						record: updated,
						validate: false,
					});
					assert(put.data.uri.includes("/space/"));
					const read = await agent.com.atproto.repo.getRecord({
						repo: did,
						...ref,
					});
					assert.deepEqual(read.data.value, updated);
					await agent.com.atproto.repo.applyWrites({
						repo: did,
						validate: false,
						writes: [
							{ $type: "com.atproto.repo.applyWrites#update", ...ref, value },
						],
					});
				},
			);
			const privateRecord = await pds.readPrivate(ref);
			assert(privateRecord);
			await pds.createPublic(ref, privateRecord);
			assert.deepEqual(await pds.readPublic(ref), privateRecord);
			await pds.deletePrivate(ref, privateRecord.cid);
			assert.equal(await pds.readPrivate(ref), undefined);
			await pds.deletePublic(ref, privateRecord.cid);
			console.log(
				`PASS reference ${collection}: copy, verify, private put/get/applyWrites, publish, standard delete`,
			);
		}
	}
}
if (process.argv.includes("--scope")) {
	process.stdout.write(buildOAuthScope({ watchPrivacyEnabled: true }));
} else {
	void main().catch((error) => {
		console.error(
			error instanceof Error ? error.message : "Reference smoke failed",
		);
		process.exitCode = 1;
	});
}
