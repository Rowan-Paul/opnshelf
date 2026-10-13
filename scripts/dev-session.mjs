import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	rmSync,
	readdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const owner =
	process.env.OPNSHELF_DEV_OWNER || process.env.CODEX_THREAD_ID || root;
export const leaseRoot =
	process.env.OPNSHELF_DEV_LEASE_DIR ||
	join(homedir(), ".local/share/opnshelf-dev-leases");
export function processIdentity(pid) {
	try {
		return (
			execFileSync("ps", ["-p", String(pid), "-o", "lstart="], {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			}).trim() || null
		);
	} catch {
		return null;
	}
}
export function claim(resource, metadata, directory = leaseRoot) {
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	const path = join(
		directory,
		createHash("sha256").update(resource).digest("hex"),
	);
	try {
		mkdirSync(path, { mode: 0o700 });
	} catch (error) {
		if (error.code !== "EEXIST") throw error;
		throw new Error(
			`Resource ${resource} is claimed; inspect pnpm dev:status before releasing it`,
		);
	}
	writeFileSync(
		join(path, "owner.json"),
		JSON.stringify({ resource, ...metadata }, null, 2),
		{ mode: 0o600 },
	);
	return path;
}
export function release(resource, expectedOwner, directory = leaseRoot) {
	const path = join(
		directory,
		createHash("sha256").update(resource).digest("hex"),
	);
	const metadata = JSON.parse(readFileSync(join(path, "owner.json"), "utf8"));
	if (metadata.owner !== expectedOwner)
		throw new Error(`Resource ${resource} belongs to ${metadata.owner}`);
	rmSync(path, { recursive: true });
}
export function releaseStale(resource, expectedOwner, directory = leaseRoot) {
	const path = join(
		directory,
		createHash("sha256").update(resource).digest("hex"),
	);
	const metadata = JSON.parse(readFileSync(join(path, "owner.json"), "utf8"));
	if (!metadata.pid || processIdentity(metadata.pid) === metadata.identity)
		throw new Error(
			"Runner is live or ownership is incomplete; stop its owner first",
		);
	if (metadata.sessionPath && existsSync(metadata.sessionPath)) {
		const session = JSON.parse(readFileSync(metadata.sessionPath));
		if (session.processes?.some((child) => processIdentity(child.pid)))
			throw new Error(
				"Recorded child process is still alive; inspect it before releasing the claim",
			);
	}
	if (metadata.processes?.some((child) => processIdentity(child.pid)))
		throw new Error(
			"Recorded child process is still alive; inspect it before releasing the claim",
		);
	release(resource, expectedOwner, directory);
}
export function routeInputs(workspace = root) {
	const routes = [];
	const app = join(workspace, "apps/mobile/src/app");
	function scan(directory) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) scan(path);
			else if (/\.[jt]sx?$/.test(entry.name))
				routes.push(path.slice(app.length));
		}
	}
	scan(app);
	const generated = join(workspace, "apps/mobile/.expo/types/router.d.ts");
	return {
		routes: routes.sort(),
		generatedHash: existsSync(generated)
			? createHash("sha256").update(readFileSync(generated)).digest("hex")
			: null,
	};
}
export function recordRoutes(workspace = root) {
	const current = routeInputs(workspace);
	if (!current.generatedHash)
		throw new Error("Start Metro to generate Expo route types first");
	writeFileSync(
		join(workspace, "apps/mobile/.expo/opnshelf-route-inputs.json"),
		JSON.stringify(current),
		{ mode: 0o600 },
	);
}
export async function recordRoutesWhenReady(port) {
	for (let attempt = 0; attempt < 60; attempt++) {
		try {
			if (
				(
					await fetch(`http://127.0.0.1:${port}/status`, {
						signal: AbortSignal.timeout(1000),
					})
				).ok &&
				routeInputs().generatedHash
			) {
				recordRoutes();
				return;
			}
		} catch {
			/* Metro has not generated types yet. */
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error("Metro/Expo route types did not become ready");
}
export function nativeFingerprint(workspace = root) {
	const hash = createHash("sha256");
	for (const file of ["apps/mobile/package.json", "apps/mobile/app.config.ts"])
		hash.update(readFileSync(join(workspace, file)));
	const modules = join(workspace, "apps/mobile/modules");
	function add(directory) {
		if (!existsSync(directory)) return;
		for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
			(a, b) => a.name.localeCompare(b.name),
		)) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) add(path);
			else if (entry.isFile()) {
				hash.update(path.slice(workspace.length));
				hash.update(readFileSync(path));
			}
		}
	}
	add(modules);
	add(join(workspace, "apps/mobile/plugins"));
	// Resolved versions catch updates within a semver range, not just package edits.
	const dependencies = JSON.parse(
		readFileSync(join(workspace, "apps/mobile/package.json")),
	).dependencies;
	for (const name of Object.keys(dependencies).sort()) {
		const file = join(
			workspace,
			"apps/mobile/node_modules",
			name,
			"package.json",
		);
		if (existsSync(file))
			hash.update(`${name}:${JSON.parse(readFileSync(file)).version}`);
	}
	return hash.digest("hex");
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		const [command = "status", device] = process.argv.slice(2);
		if (command === "status") {
			const entries = existsSync(leaseRoot)
				? readdirSync(leaseRoot)
						.filter((name) => name !== "builds")
						.map((name) => {
							const path = join(leaseRoot, name, "owner.json");
							if (!existsSync(path))
								return {
									resource: name,
									state: "claim incomplete; inspect owner before release",
								};
							const value = JSON.parse(readFileSync(path));
							return {
								...value,
								runnerAlive: value.pid
									? processIdentity(value.pid) === value.identity
									: undefined,
							};
						})
				: [];
			console.log(JSON.stringify(entries, null, 2));
		} else if (command === "claim-device" && device) {
			claim(`device:${device}`, {
				owner,
				worktree: root,
				claimedAt: new Date().toISOString(),
			});
			console.log(
				`Claimed ${device} for ${owner}. Release explicitly after verification.`,
			);
		} else if (command === "release-device" && device) {
			release(`device:${device}`, owner);
		} else if (command === "release-stale-stack" && device) {
			releaseStale(`stack:${device}`, owner);
		} else if (command === "record-routes") {
			recordRoutes();
		} else if (command === "record-build" && device) {
			const path = join(leaseRoot, "builds");
			mkdirSync(path, { recursive: true, mode: 0o700 });
			writeFileSync(
				join(path, createHash("sha256").update(device).digest("hex") + ".json"),
				JSON.stringify({
					device,
					fingerprint: nativeFingerprint(),
					worktree: root,
				}),
				{ mode: 0o600 },
			);
			console.log(
				"Recorded installed build fingerprint. Record only after building and installing this checkout.",
			);
		} else if (command === "doctor") {
			const snapshot = join(
				root,
				"apps/mobile/.expo/opnshelf-route-inputs.json",
			);
			const missing =
				!existsSync(snapshot) ||
				JSON.stringify(JSON.parse(readFileSync(snapshot))) !==
					JSON.stringify(routeInputs());
			console.log(
				`Expo route types: ${missing ? "unverified or stale; start managed Metro or record-routes after regeneration" : "match recorded route inputs"}`,
			);
			let stale = false;
			if (device) {
				const path = join(
					leaseRoot,
					"builds",
					createHash("sha256").update(device).digest("hex") + ".json",
				);
				stale =
					!existsSync(path) ||
					JSON.parse(readFileSync(path)).fingerprint !== nativeFingerprint();
				console.log(
					`Native build ${device}: ${stale ? "unverified or stale; rebuild/install before verification" : "matches recorded native inputs"}`,
				);
			}
			if (missing || stale) process.exitCode = 1;
		} else
			throw new Error(
				"Use status, doctor [DEVICE], claim-device DEVICE, release-device DEVICE, record-build DEVICE, release-stale-stack STACK_NAME, or record-routes",
			);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
