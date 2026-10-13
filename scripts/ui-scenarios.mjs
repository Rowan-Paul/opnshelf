// Loopback-only API fixtures. Never proxy requests to a real backend or PDS.
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
	root,
	owner,
	claim,
	release,
	processIdentity,
	recordRoutesWhenReady,
} from "./dev-session.mjs";

const spec = JSON.parse(readFileSync(join(root, "backend/openapi.json")));
export const scenarios = [
	"normal",
	"failed-settings",
	"delayed-auth",
	"sheet-overlap",
	"migration-running",
	"conflict",
	"compact",
	"large-text",
];
function sample(schema, seen = new Set()) {
	if (!schema) return {};
	if (schema.$ref) {
		const name = schema.$ref.split("/").at(-1);
		if (seen.has(name)) return null;
		return sample(spec.components.schemas[name], new Set([...seen, name]));
	}
	if (schema.enum) return schema.enum[0];
	if (schema.nullable) return null;
	if (schema.allOf)
		return Object.assign({}, ...schema.allOf.map((s) => sample(s, seen)));
	if (schema.type === "array") return [];
	if (schema.type === "boolean") return false;
	if (schema.type === "number" || schema.type === "integer") return 0;
	if (schema.type === "string") return "";
	return Object.fromEntries(
		Object.entries(schema.properties || {})
			.filter(([key]) => schema.required?.includes(key))
			.map(([key, value]) => [key, sample(value, seen)]),
	);
}
export function createScenarioServer(initial = "normal") {
	if (!scenarios.includes(initial)) throw new Error("Unknown UI scenario");
	let scenario = initial,
		authorized = !["sheet-overlap", "delayed-auth"].includes(initial),
		completed = false;
	const settings = {
		...sample(spec.components.schemas.UserSettingsDto),
		timezone: "Europe/Amsterdam",
		watchCountry: "NL",
		streamingServiceIds: [8],
		welcomeTourWebVersion: 999,
		welcomeTourMobileVersion: 999,
	};
	const user = {
		...sample(spec.components.schemas.UserDto),
		did: "did:plc:bbbbbbbbbbbbbbbbbbbbbbbb",
		handle: "synthetic.test",
		displayName: "Local scenario",
		emailVerifiedAt: "2026-01-01T00:00:00.000Z",
		needsEmailVerification: false,
	};
	return createServer(async (req, res) => {
		const url = new URL(req.url, "http://127.0.0.1:3391");
		const origin = req.headers.origin;
		if (
			origin &&
			origin !== "http://127.0.0.1:3390" &&
			origin !== "http://127.0.0.1:3391"
		) {
			res.writeHead(403).end();
			return;
		}
		res.setHeader(
			"Access-Control-Allow-Origin",
			origin || "http://127.0.0.1:3390",
		);
		res.setHeader("Access-Control-Allow-Credentials", "true");
		res.setHeader(
			"Access-Control-Allow-Headers",
			"content-type, authorization, x-opnshelf-device, x-opnshelf-device-name, x-opnshelf-device-platform",
		);
		res.setHeader(
			"Access-Control-Allow-Methods",
			"GET, POST, PATCH, DELETE, OPTIONS",
		);
		res.setHeader("Cache-Control", "no-store");
		const json = (value, status = 200) => {
			res
				.writeHead(status, { "content-type": "application/json" })
				.end(JSON.stringify(value));
		};
		if (req.method === "OPTIONS") {
			res.writeHead(204).end();
			return;
		}
		let body = {};
		if (req.method !== "GET") {
			try {
				const chunks = [];
				let size = 0;
				for await (const chunk of req) {
					size += chunk.length;
					if (size > 65536) throw new Error();
					chunks.push(chunk);
				}
				body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
			} catch {
				json({ message: "Invalid fixture request" }, 400);
				return;
			}
		}
		if (url.pathname === "/__scenario" && req.method === "POST") {
			if (!scenarios.includes(body.scenario)) {
				json({ message: "Unknown scenario" }, 400);
				return;
			}
			scenario = body.scenario;
			authorized = !["sheet-overlap", "delayed-auth"].includes(scenario);
			completed = false;
			json({ scenario });
			return;
		}
		if (url.pathname === "/__scenario") {
			res
				.writeHead(200, { "content-type": "text/html" })
				.end(
					`<!doctype html><meta name="viewport" content="width=device-width"><title>Opnshelf local scenarios</title><h1>Local verification scenarios</h1><p>API fixtures only; no real accounts or records. Current: ${scenario}</p><select id="scenario">${scenarios.map((s) => `<option${s === scenario ? " selected" : ""}>${s}</option>`).join("")}</select><button onclick="fetch('/__scenario',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scenario:document.querySelector('select').value})}).then(()=>location.reload())">Reset scenario</button><p><a href="http://127.0.0.1:3390/onboarding">Web onboarding</a> · <a href="http://127.0.0.1:3390/settings/privacy">Web Privacy</a> · <a href="opnshelf://auth/complete?session=fixture-only">Mobile fixture sign-in</a></p><p>Reload the app after changing scenarios. Compact and large-text require device display/font settings. Never use the fixture sign-in with a real API.</p>`,
				);
			return;
		}
		if (url.pathname === "/__authorize") {
			const mobile = url.searchParams.get("platform") === "mobile";
			const delay = scenario === "delayed-auth" ? 4500 : 0;
			const destination = mobile
				? "opnshelf://auth/complete?session=fixture-only"
				: "http://127.0.0.1:3390/settings/privacy";
			res
				.writeHead(200, { "content-type": "text/html" })
				.end(
					`<!doctype html><meta name="viewport" content="width=device-width"><title>Fixture authorization</title><h1>Synthetic authorization</h1><p>This tests presentation and callbacks, not real OAuth.</p><button onclick="fetch('/__grant',{method:'POST'}).then(()=>setTimeout(()=>location.href=${JSON.stringify(destination)},${delay}))">Allow fixture access</button><button onclick="location.href=${JSON.stringify(mobile ? "opnshelf://auth/complete?error=access_denied" : "http://127.0.0.1:3390/settings/privacy?privacyAuthorization=declined")}">Decline</button>`,
				);
			return;
		}
		if (url.pathname === "/__grant") {
			authorized = true;
			json({});
			return;
		}
		if (url.pathname === "/auth/login") {
			res
				.writeHead(302, {
					location: `/__authorize?platform=${url.searchParams.get("platform") || "web"}`,
				})
				.end();
			return;
		}
		if (
			[
				"/users/me/account-deletion",
				"/users/me/import/trakt/public/current",
			].includes(url.pathname)
		) {
			json(null);
			return;
		}
		if (url.pathname === "/auth/me") {
			json({
				...user,
				needsOnboarding: !completed,
				onboardingCompletedAt: completed ? "2026-01-01T00:00:00.000Z" : null,
			});
			return;
		}
		if (url.pathname === "/auth/mobile/challenge") {
			json({
				codeVerifier: "fixture-only-verifier",
				codeChallenge: "fixture-only-challenge",
			});
			return;
		}
		if (url.pathname === "/auth/mobile/exchange") {
			json({ sessionId: "fixture-only" });
			return;
		}
		if (url.pathname === "/users/me/onboarding/complete") {
			completed = true;
			json({
				...user,
				needsOnboarding: false,
				onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
			});
			return;
		}
		if (url.pathname === "/users/me/settings") {
			if (scenario === "failed-settings") {
				json({ statusCode: 503, message: "Fixture settings unavailable" }, 503);
				return;
			}
			if (req.method === "PATCH") Object.assign(settings, body);
			json(settings);
			return;
		}
		if (url.pathname === "/auth/permissions") {
			json({
				authorizationUrl: `http://127.0.0.1:3391/__authorize?platform=${body.platform || "web"}`,
			});
			return;
		}
		if (url.pathname === "/users/me/privacy") {
			const migration =
				scenario === "migration-running"
					? {
							id: "fixture-migration",
							target: "private",
							status: "running",
							copied: 3,
							total: 10,
							error: null,
						}
					: null;
			json({
				availability: "available",
				authorized,
				listsDefaultVisibility: "public",
				alphaDetails: "Local scenario only",
				scopes: ["watches", "library", "notes", "lists"].map((category) => ({
					category,
					listRkey: category === "lists" ? "fixture-list" : null,
					label: {
						watches: "Shelf",
						library: "Library",
						notes: "Notes",
						lists: "Fixture List",
					}[category],
					visibility: "public",
					migration: category === "lists" ? migration : null,
				})),
			});
			return;
		}
		if (url.pathname.startsWith("/users/me/privacy/")) {
			if (scenario === "conflict") {
				json(
					{
						statusCode: 409,
						error: "Conflict",
						message: "Another Watch operation is in progress. Try again.",
					},
					409,
				);
				return;
			}
			if (
				url.pathname.endsWith("/change-all") ||
				url.pathname.endsWith("/change")
			)
				scenario = "migration-running";
			json({});
			return;
		}
		if (url.pathname === "/notifications/settings") {
			json({
				...sample(spec.components.schemas.NotificationSettingsDto),
				email: "fixture@example.com",
				emailVerified: true,
				pushDeviceCount: 0,
			});
			return;
		}
		if (url.pathname === "/trakt-sync") {
			json({ configured: false, connected: false });
			return;
		}
		if (url.pathname === "/discover/onboarding") {
			json({
				items: [
					{
						id: 1,
						media_type: "movie",
						title: "A deliberately long fixture title for layout checks",
						popularity: 1,
						vote_average: 8,
						vote_count: 1,
						release_date: "2026-01-01",
						poster_path: null,
					},
				],
			});
			return;
		}
		const operation = spec.paths[url.pathname]?.[req.method.toLowerCase()];
		if (operation) {
			const response = operation.responses["200"] || operation.responses["201"];
			json(sample(response?.content?.["application/json"]?.schema));
			return;
		}
		// Unknown requests fail visibly instead of silently contacting production.
		json(
			{
				statusCode: 404,
				message: `Unimplemented local fixture: ${req.method} ${url.pathname}`,
			},
			404,
		);
	});
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const [clients = "web", scenario = "normal"] = process.argv.slice(2);
	const children = [];
	let leasePath;
	let server,
		claimed = false;
	const resource = "stack:ui-scenarios";
	function cleanup() {
		for (const child of children) {
			try {
				process.kill(-child.pid, "SIGTERM");
			} catch {}
		}
		server?.close();
		if (claimed) {
			release(resource, owner);
			claimed = false;
		}
	}
	process.on("SIGINT", cleanup);
	process.on("SIGTERM", cleanup);
	try {
		if (!["web", "mobile", "both", "api"].includes(clients))
			throw new Error("Use web, mobile, both or api [SCENARIO]");
		leasePath = claim(resource, {
			owner,
			worktree: root,
			pid: process.pid,
			identity: processIdentity(process.pid),
			backend: "http://127.0.0.1:3391",
			ports: { web: 3390, api: 3391, metro: 8084 },
		});
		claimed = true;
		server = createScenarioServer(scenario);
		await new Promise((resolve, reject) => {
			server.once("error", reject);
			server.listen(3391, "127.0.0.1", resolve);
		});
		const start = (args, env) => {
			const child = spawn("pnpm", args, {
				cwd: root,
				detached: true,
				env: { ...process.env, ...env },
				stdio: "inherit",
			});
			children.push(child);
			const metadata = JSON.parse(readFileSync(join(leasePath, "owner.json")));
			metadata.processes = children.map((process) => ({ pid: process.pid }));
			writeFileSync(
				join(leasePath, "owner.json"),
				JSON.stringify(metadata, null, 2),
				{ mode: 0o600 },
			);
			child.on("error", (error) => {
				console.error(error.message);
				cleanup();
				process.exitCode = 1;
			});
			child.on("exit", (code) => {
				cleanup();
				if (code) process.exitCode = code;
			});
		};
		if (clients === "web" || clients === "both")
			start(
				[
					"--filter",
					"web",
					"dev",
					"--host",
					"127.0.0.1",
					"--port",
					"3390",
					"--strictPort",
				],
				{
					VITE_API_URL: "http://127.0.0.1:3391",
					SERVER_URL: "http://127.0.0.1:3391",
				},
			);
		if (clients === "mobile" || clients === "both")
			start(
				[
					"--filter",
					"mobile",
					"start",
					"--dev-client",
					"--port",
					"8084",
					"--lan",
				],
				{
					EXPO_NO_DOTENV: "1",
					REACT_NATIVE_PACKAGER_HOSTNAME: "127.0.0.1",
					EXPO_PUBLIC_API_URL: "http://127.0.0.1:3391",
					EXPO_PUBLIC_PDS_HANDLE_DOMAIN: "test",
					EXPO_PUBLIC_POSTHOG_KEY: "",
				},
			);
		if (clients === "mobile" || clients === "both")
			await recordRoutesWhenReady(8084);
		console.log(
			"Scenario controller: http://127.0.0.1:3391/__scenario. Mobile requires a dev client; Android: adb reverse tcp:3391 tcp:3391 and tcp:8084 tcp:8084.",
		);
	} catch (error) {
		console.error(error.message);
		cleanup();
		process.exitCode = 1;
	}
}
