/**
 * Publish our lexicons to the network per the atproto Lexicon resolution spec.
 *
 * Each lexicon becomes a `com.atproto.lexicon.schema` record (rkey = the NSID)
 * in the admin account's repo. Resolvers find them via a DNS TXT record at
 * `_lexicon.opnshelf.xyz` pointing to that account's DID (printed at the end).
 *
 * Only `xyz.opnshelf.*` is ours to publish — at.markpub.* / site.standard.*
 * belong to other authorities and are skipped.
 *
 * Run: pnpm --filter backend exec ts-node scripts/publish-lexicons.ts
 *      add --dry to preview without writing.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { AtpAgent } from "@atproto/api";

const LEXICON_DIR = resolve(__dirname, "../../lexicons");
const AUTHORITY = "xyz.opnshelf"; // only publish what we control
const COLLECTION = "com.atproto.lexicon.schema";
const DRY = process.argv.includes("--dry");

// Tiny .env loader — backend/.env, no dep on dotenv being a direct dependency.
function loadEnv() {
	const envPath = resolve(__dirname, "../.env");
	if (!existsSync(envPath)) return;
	for (const line of readFileSync(envPath, "utf8").split("\n")) {
		const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
		if (!m || line.trim().startsWith("#")) continue;
		const [, k, raw] = m;
		if (process.env[k] === undefined)
			process.env[k] = raw.replace(/^["']|["']$/g, "");
	}
}

function findLexicons(dir: string): string[] {
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((e) => e.isFile() && e.name.endsWith(".json"))
		.map((e) => join(e.parentPath ?? (e as { path: string }).path, e.name));
}

async function main() {
	loadEnv();
	const { PDS_URL, PDS_ADMIN_IDENTIFIER, PDS_ADMIN_PASSWORD } = process.env;
	if (!PDS_URL || !PDS_ADMIN_IDENTIFIER || !PDS_ADMIN_PASSWORD) {
		throw new Error(
			"Need PDS_URL, PDS_ADMIN_IDENTIFIER, PDS_ADMIN_PASSWORD (backend/.env).",
		);
	}

	const docs = findLexicons(LEXICON_DIR)
		.map((f) => JSON.parse(readFileSync(f, "utf8")))
		.filter((d) => typeof d.id === "string" && d.id.startsWith(AUTHORITY));

	if (docs.length === 0) throw new Error(`No ${AUTHORITY}.* lexicons found.`);
	console.log(`Found ${docs.length} ${AUTHORITY}.* lexicons.`);

	const agent = new AtpAgent({ service: PDS_URL });
	await agent.login({
		identifier: PDS_ADMIN_IDENTIFIER,
		password: PDS_ADMIN_PASSWORD,
	});
	const did = agent.assertDid;

	for (const doc of docs) {
		const record = { ...doc, $type: COLLECTION };
		if (DRY) {
			console.log(`  [dry] would put ${doc.id}`);
			continue;
		}
		// validate:false — Tranquil may not host the schema lexicon to validate against.
		await agent.com.atproto.repo.putRecord({
			repo: did,
			collection: COLLECTION,
			rkey: doc.id, // rkey MUST equal the NSID
			record,
			validate: false,
		});
		console.log(`  published ${doc.id}`);
	}

	console.log(
		`\nDone. Now set DNS so resolvers find them:\n` +
			`  TXT  _lexicon.opnshelf.xyz  "did=${did}"\n` +
			(DRY ? "(dry run — nothing written)\n" : ""),
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
