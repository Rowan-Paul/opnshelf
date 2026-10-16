import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	claim,
	release,
	processIdentity,
	releaseStale,
} from "./dev-session.mjs";

test("exclusive resource claims preserve another owner and require explicit release", () => {
	const path = mkdtempSync(join(tmpdir(), "opnshelf-lease-"));
	try {
		claim("device:example", { owner: "first" }, path);
		assert.throws(
			() => claim("device:example", { owner: "second" }, path),
			/claimed/,
		);
		assert.throws(
			() => release("device:example", "second", path),
			/belongs to first/,
		);
		release("device:example", "first", path);
		assert.doesNotThrow(() =>
			claim("device:example", { owner: "second" }, path),
		);
		assert.ok(processIdentity(process.pid));
		assert.equal(processIdentity(2147483647), null);
	} finally {
		rmSync(path, { recursive: true, force: true });
	}
});

test("local stack refuses another owner and releases its own claim after startup failure", async () => {
	const { mkdirSync, writeFileSync, readFileSync, readdirSync } = await import(
		"node:fs"
	);
	const { execFileSync } = await import("node:child_process");
	const path = mkdtempSync(join(tmpdir(), "opnshelf-stack-"));
	try {
		const state = join(path, "state");
		const source = join(path, "source");
		const leases = join(path, "leases");
		mkdirSync(state);
		mkdirSync(join(source, "crates/tranquil-server"), { recursive: true });
		const session = {
			owner: "another-thread",
			worktree: "/another/worktree",
			pid: 4242,
		};
		writeFileSync(join(state, "session.json"), JSON.stringify(session));
		const env = {
			...process.env,
			TRANQUIL_SOURCE: source,
			OPNSHELF_SPACES_STATE_DIR: state,
			OPNSHELF_DEV_LEASE_DIR: leases,
			OPNSHELF_DEV_OWNER: "this-thread",
		};
		assert.throws(
			() =>
				execFileSync(process.execPath, ["scripts/local-spaces.mjs", "stop"], {
					env,
					stdio: "pipe",
				}),
			(error) =>
				error.stderr.toString().includes("Stack belongs to another-thread"),
		);
		assert.deepEqual(
			JSON.parse(readFileSync(join(state, "session.json"))),
			session,
		);
		assert.throws(
			() =>
				execFileSync(process.execPath, ["scripts/local-spaces.mjs", "start"], {
					env,
					stdio: "pipe",
				}),
			(error) =>
				error.stderr.toString().includes("Run pnpm dev:spaces:setup first"),
		);
		assert.deepEqual(readdirSync(leases), []);
	} finally {
		rmSync(path, { recursive: true, force: true });
	}
});

test("stale claims can be released only by their owner and cannot release a live runner", () => {
	const directory = mkdtempSync(join(tmpdir(), "opnshelf-stale-"));
	try {
		claim(
			"stack:live",
			{
				owner: "first",
				pid: process.pid,
				identity: processIdentity(process.pid),
			},
			directory,
		);
		assert.throws(
			() => releaseStale("stack:live", "first", directory),
			/Runner is live/,
		);
		claim(
			"stack:dead",
			{ owner: "first", pid: 2147483647, identity: "old" },
			directory,
		);
		assert.throws(
			() => releaseStale("stack:dead", "second", directory),
			/belongs to first/,
		);
		assert.doesNotThrow(() => releaseStale("stack:dead", "first", directory));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("route snapshots notice renamed routes and native fingerprints notice resolved dependency updates", async () => {
	const { mkdirSync, writeFileSync, renameSync } = await import("node:fs");
	const { routeInputs, nativeFingerprint } = await import("./dev-session.mjs");
	const path = mkdtempSync(join(tmpdir(), "opnshelf-doctor-"));
	try {
		mkdirSync(join(path, "apps/mobile/src/app"), { recursive: true });
		mkdirSync(join(path, "apps/mobile/.expo/types"), { recursive: true });
		mkdirSync(join(path, "apps/mobile/node_modules/expo"), { recursive: true });
		writeFileSync(
			join(path, "apps/mobile/src/app/index.tsx"),
			"export default function Home() {}",
		);
		writeFileSync(
			join(path, "apps/mobile/.expo/types/router.d.ts"),
			'type Route = "/";',
		);
		writeFileSync(
			join(path, "apps/mobile/package.json"),
			JSON.stringify({ dependencies: { expo: "~57.0.0" } }),
		);
		writeFileSync(
			join(path, "apps/mobile/app.config.ts"),
			'export default { version: "1.6.4" };',
		);
		writeFileSync(
			join(path, "apps/mobile/node_modules/expo/package.json"),
			'{"version":"57.0.24"}',
		);
		const before = routeInputs(path);
		const native = nativeFingerprint(path);
		renameSync(
			join(path, "apps/mobile/src/app/index.tsx"),
			join(path, "apps/mobile/src/app/profile.tsx"),
		);
		assert.notDeepEqual(routeInputs(path), before);
		writeFileSync(
			join(path, "apps/mobile/node_modules/expo/package.json"),
			'{"version":"57.0.25"}',
		);
		assert.notEqual(nativeFingerprint(path), native);
	} finally {
		rmSync(path, { recursive: true, force: true });
	}
});
