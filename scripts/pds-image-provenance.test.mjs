import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assertCompatible,
	migrationManifest,
} from "./pds-image-provenance.mjs";

test("rejects missing, changed, or absent deployed migrations; permits additions", () => {
	const root = mkdtempSync(join(tmpdir(), "pds-provenance-"));
	try {
		mkdirSync(join(root, "migrations"));
		const path = join(root, "migrations/20261006_spaces.sql");
		writeFileSync(path, "CREATE TABLE spaces (id text);");
		const baseline = migrationManifest(root);
		assert.throws(
			() => assertCompatible(undefined, baseline),
			/provenance is missing/,
		);
		assert.throws(() => assertCompatible(baseline, {}), /removes or changes/);
		writeFileSync(path, "DROP TABLE spaces;");
		assert.throws(
			() => assertCompatible(baseline, migrationManifest(root)),
			/removes or changes/,
		);
		writeFileSync(path, "CREATE TABLE spaces (id text);");
		writeFileSync(
			join(root, "migrations/20261007_blobs.sql"),
			"CREATE TABLE blobs (id text);",
		);
		assert.doesNotThrow(() =>
			assertCompatible(baseline, migrationManifest(root)),
		);
		assert.throws(
			() => assertCompatible({ migration: "not-a-hash" }, {}),
			/Invalid baseline/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
