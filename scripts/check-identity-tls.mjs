// Live advisory check: run with the same Node binary as the backend.
// https://bsky.app/profile/atproto.com/post/3mye7adjcu223
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../backend/package.json", import.meta.url));
const { IdResolver } = require("@atproto/identity");
const resolver = new IdResolver({ timeout: 10_000 });
const handle = "emudhra.divy.zone";
const did = `did:web:${handle}`;

// A timeout or DNS failure must not count as successful certificate rejection.
await assert.rejects(
	fetch(`https://${handle}/.well-known/did.json`, {
		signal: AbortSignal.timeout(10_000),
	}),
	(error) => error.cause?.code === "CERT_REVOKED",
);
assert.equal(await resolver.handle.resolve(handle), undefined);
await assert.rejects(resolver.did.resolve(did));
console.log(`Node ${process.version}: TLS, handle and DID rejection passed`);
