import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const api = new URL("../packages/api/", import.meta.url);
const hasTypeScript = existsSync(new URL("node_modules/typescript/package.json", api));

test("API comment baseline rejects additions and permanently prunes deletions", {
	skip: !hasTypeScript && "Requires the workspace install used by the API CI job",
}, (context) => {
	const root = pathToFileURL(mkdtempSync(join(tmpdir(), "api-comments-")) + "/");
	context.after(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(new URL("packages/api/src/generated/", root), { recursive: true });
	mkdirSync(new URL("scripts/", root));
	symlinkSync(new URL("node_modules/", api), new URL("packages/api/node_modules", root));
	const script = new URL("scripts/check-api-comments.mjs", root);
	copyFileSync(new URL("./check-api-comments.mjs", import.meta.url), script);
	const baseline = new URL("scripts/api-comment-baseline.json", root);
	const fixture = new URL("packages/api/src/fixture.ts", root);
	writeFileSync(new URL("packages/api/src/generated/sample.ts", root), "// generated\n");

	const comment = "/** @deprecated Old */";
	const hash = createHash("sha256").update(comment).digest("hex");
	writeFileSync(baseline, JSON.stringify({ [`fixture.ts:${hash}`]: 1 }));
	const source = 'function legacy() {}\nconst url = "https://example.test";\nconst literal = `/* text */`;\n';
	function check(expectedStatus, ...args) {
		const result = spawnSync(process.execPath, [fileURLToPath(script), ...args], {
			encoding: "utf8",
		});
		assert.equal(result.status, expectedStatus, result.stderr);
		return result;
	}

	writeFileSync(fixture, `${comment}\n${source}`);
	check(0);
	const listing = check(0, "--list").stdout;
	assert.ok(listing.includes(comment));
	assert.match(listing, /1 comment-only lines remain/);
	writeFileSync(fixture, `${comment.replace("deprecated", "internal")}\n${source}`);
	assert.match(check(1).stderr, /New or edited comment/);
	writeFileSync(fixture, `${comment}\n${source}${comment}\nfunction duplicate() {}\n`);
	assert.match(check(1, "--prune").stderr, /New or edited comment/);

	writeFileSync(fixture, source);
	assert.match(check(1).stderr, /--prune/);
	assert.match(check(1, "--prnue").stderr, /Usage/);
	check(0, "--prune");
	assert.deepEqual(JSON.parse(readFileSync(baseline, "utf8")), {});
	check(0);

	writeFileSync(fixture, `${comment}\n${source}`);
	check(1);
});
