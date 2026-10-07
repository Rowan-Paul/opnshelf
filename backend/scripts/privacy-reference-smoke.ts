/** Run only against a disposable reference Spaces PDS with local PLC.
 * Account passwords and bearer tokens are generated/consumed in memory and never logged.
 * This checks wire compatibility, not the separate OAuth browser consent flow. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { WatchMigrationPds } from "../src/privacy/watch-migration-pds";
import { PRIVACY_CATEGORIES, privacyRepositoryConfig } from "../src/privacy/privacy-category";
import { createWatchAgent, watchOperation } from "../src/privacy/watch-operation";

async function main() {
 const base = process.env.PRIVACY_REFERENCE_PDS_URL ?? "http://127.0.0.1:3203";
 assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Disposable local PDS only");
 const create = await fetch(`${base}/xrpc/com.atproto.server.createAccount`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: `p${randomBytes(5).toString("hex")}.test`, email: `privacy-${Date.now()}@example.com`, password: randomBytes(24).toString("base64url") }) });
 const account = await create.json();
 assert(create.ok && typeof account.did === "string" && typeof account.accessJwt === "string", `Synthetic account creation failed: ${create.status} ${account.error ?? ""}: ${account.message ?? ""}`);
 const did: string = account.did;
 for (const category of PRIVACY_CATEGORIES) {
  const config = privacyRepositoryConfig(category, category === "lists" ? "smoke-list" : undefined);
  const session = {
   did,
   getTokenInfo: async () => ({ scope: config.scope }),
   fetchHandler: (path: string, init?: RequestInit) => fetch(new URL(path, base), { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), authorization: `Bearer ${account.accessJwt}` } }),
  };
  const pds = new WatchMigrationPds(did, session, undefined, config);
  await pds.assertPrivate();
  for (const collection of config.collections) {
   const ref = { collection, rkey: "3mxclabc36s2i" };
   const value = { $type: collection, test: "disposable", extension: { preserve: true } };
   const result = await session.fetchHandler("/xrpc/com.atproto.repo.putRecord", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo: did, ...ref, record: value, validate: false }) });
   assert(result.ok, `Public seed failed: ${result.status}`);
   const source = await pds.readPublic(ref);
   assert(source);
   await pds.createPrivate(ref, source);
   assert.deepEqual(await pds.readPrivate(ref), source);
   await pds.deletePublic(ref, source.cid);
   assert.equal(await pds.readPublic(ref), undefined);
   const page = await pds.list(collection, true);
   assert(page.records.some(record => record.rkey === ref.rkey && record.cid === source.cid));
   await watchOperation.run({ did, visibility: "private", signal: AbortSignal.timeout(30000), repository: config }, async () => {
    const agent = createWatchAgent(session);
    const updated = { ...value, test: "updated" };
    const put = await agent.com.atproto.repo.putRecord({ repo: did, ...ref, record: updated, validate: false });
    assert(put.data.uri.includes("/space/"));
    const read = await agent.com.atproto.repo.getRecord({ repo: did, ...ref });
    assert.deepEqual(read.data.value, updated);
    await agent.com.atproto.repo.applyWrites({ repo: did, validate: false, writes: [{ $type: "com.atproto.repo.applyWrites#update", ...ref, value }] });
   });
   const privateRecord = await pds.readPrivate(ref);
   assert(privateRecord);
   await pds.createPublic(ref, privateRecord);
   assert.deepEqual(await pds.readPublic(ref), privateRecord);
   await pds.deletePrivate(ref, privateRecord.cid);
   assert.equal(await pds.readPrivate(ref), undefined);
   await pds.deletePublic(ref, privateRecord.cid);
   console.log(`PASS reference ${collection}: copy, verify, private put/get/applyWrites, publish, standard delete`);
  }
 }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Reference smoke failed"); process.exitCode = 1; });
