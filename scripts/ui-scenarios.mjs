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
	"native-tabs-guest",
	"native-tabs-verify",
	"native-tabs-avatar",
	"failed-settings",
 "privacy-unsupported",
 "privacy-unavailable",
	"delayed-auth",
	"sheet-overlap",
	"migration-running",
	"conflict",
	"compact",
	"large-text",
	"trakt-sync-catch-up",
	"trakt-sync-error",
	"trakt-sync-attention",
	"trakt-sync-lists",
 "issue-fixes",
 "trakt-sync-recovery",
];
export function sample(schema, seen = new Set()) {
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
export function createScenarioServer(
 initial = "normal",
 { webOrigin = "http://127.0.0.1:3390", respond } = {},
) {
	if (!scenarios.includes(initial)) throw new Error("Unknown UI scenario");
	let scenario = initial,
		authorized = !["sheet-overlap", "delayed-auth"].includes(initial),
		completed = ["issue-fixes", "trakt-sync-error", "trakt-sync-attention", "privacy-unsupported", "privacy-unavailable"].includes(initial),
 fixtureSyncState = "idle",
 fixtureIssue = true,
 fixtureIgnored = false;
 const reviewQueue = [1, 2, 3].map((episode) => ({ id: `episode-${episode}`, ignored: false, resolved: false, episode }));
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
			origin !== webOrigin &&
			origin !== "http://127.0.0.1:3391"
		) {
			res.writeHead(403).end();
			return;
		}
		res.setHeader(
			"Access-Control-Allow-Origin",
			origin || webOrigin,
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
		if (respond?.({ req, res, url, json })) return;
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
 fixtureSyncState = "idle";
 fixtureIssue = true;
 reviewQueue.forEach((item) => { item.ignored = false; item.resolved = false; });
 fixtureIgnored = false;
			authorized = !["sheet-overlap", "delayed-auth"].includes(scenario);
			completed = ["issue-fixes", "trakt-sync-error", "trakt-sync-attention", "privacy-unsupported", "privacy-unavailable"].includes(scenario);
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
		if (url.pathname === "/__avatar") {
			res.writeHead(200, { "content-type": "image/png" }).end(
				readFileSync(join(root, "apps/mobile/assets/images/icon.png")),
			);
			return;
		}
		if (url.pathname === "/auth/me") {
			if (scenario === "native-tabs-guest") {
				json({ message: "Synthetic signed-out session" }, 401);
				return;
			}
			if (scenario === "native-tabs-verify") {
				json({ ...user, needsEmailVerification: true, needsOnboarding: true });
				return;
			}
			if (scenario === "native-tabs-avatar") {
				json({ ...user, avatar: "http://127.0.0.1:3391/__avatar", needsOnboarding: false, onboardingCompletedAt: "2026-01-01T00:00:00.000Z" });
				return;
			}
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
		if (url.pathname === "/users/me/onboarding/reset" && req.method === "POST") {
			completed = false;
			res.writeHead(204).end();
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
				availability: scenario === "privacy-unsupported" ? "unsupported" : scenario === "privacy-unavailable" ? "unavailable" : "available",
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
		if (url.pathname === "/trakt-sync/action" && req.method === "POST") {
			fixtureSyncState = "running";
			json({}); return;
		}
		if (
			scenario === "trakt-sync-attention" &&
			url.pathname === "/trakt-sync/issues"
		) {
			const items = reviewQueue.filter(
				(item) =>
					!item.resolved &&
					item.ignored === (url.searchParams.get("view") === "ignored"),
			);
			const pageSize = Math.max(
				1,
				Number(url.searchParams.get("pageSize")) || 20,
			);
			const totalPages = Math.ceil(items.length / pageSize);
			const page = Math.max(
				1,
				Math.min(Number(url.searchParams.get("page")) || 1, totalPages),
			);
			const record = (episode, key, date) => ({
				key,
				kind: "watch",
				mediaType: "episode",
				mediaId: "110492",
				title: "Peacemaker",
				season: 2,
				episode,
				displayValue: date,
			});
			json({
				page,
				pageSize,
				total: items.length,
				totalPages,
				hasPreviousPage: page > 1,
				hasNextPage: page < totalPages,
				items: items
					.slice((page - 1) * pageSize, page * pageSize)
					.map((item) => ({
						id: item.id,
						kind: "watch",
						ignored: item.ignored,
						recovery: "retry",
						issue: "Confirm whether these Watches are the same viewing.",
						trakt: record(item.episode, item.id, "2026-10-18T19:55:00Z"),
						candidates: [
							record(item.episode, `local-${item.id}`, "2026-10-18T19:53:00Z"),
						],
					})),
			});
			return;
		}
		if (
			scenario === "trakt-sync-attention" &&
			url.pathname.startsWith("/trakt-sync/issues/") &&
			req.method === "POST"
		) {
			const item = reviewQueue.find(
				(item) => item.id === url.pathname.split("/").at(-1),
			);
			if (!item) {
				json({ message: "Unknown fixture item" }, 404);
				return;
			}
			if (body.action === "ignore") item.ignored = true;
			else if (body.action === "undo") item.ignored = false;
			else item.resolved = true;
			json({});
			return;
		}
		if (url.pathname === "/trakt-sync/issues" && scenario === "trakt-sync-recovery") {
			const visible = fixtureIssue && fixtureIgnored === (url.searchParams.get("view") === "ignored");
			json({ page: 1, pageSize: 20, total: visible ? 1 : 0, totalPages: 1, items: visible ? [{ id: "uncertain", kind: "list", recovery: "verify", traktState: "unknown", ignored: fixtureIgnored, issue: "The outcome of creating this Trakt List is unknown.", opnshelf: { key: "list:fixture", kind: "list", title: "Weekend films", displayValue: "2 items", mediaType: "list", mediaId: null, season: 0, episode: 0 }, candidates: [] }] : [] }); return;
		}
		if (url.pathname === "/trakt-sync/issues/uncertain" && req.method === "POST" && scenario === "trakt-sync-recovery") {
			if (body.action === "ignore") fixtureIgnored = true;
 else if (body.action === "undo") fixtureIgnored = false;
 else fixtureIssue = false;
 json({}); return;
		}
		if (scenario === "issue-fixes" && url.pathname === "/watch-picker") {
   const minutes = Number(url.searchParams.get("minutes"));
   json({ genres: ["Drama", "Comedy"], items: minutes < 45 ? [] : [
    { id: "fixture-film", mediaType: "movie", mediaId: "1", title: "A night at the cinema", posterPath: "/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg", minutes: 90, estimated: false, episodes: [], services: [] },
    { id: "fixture-show", mediaType: "show", mediaId: "1399", title: "Local fixture show", posterPath: "/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg", minutes: 60, estimated: false, episodes: [1, 2].map(episodeNumber => ({ serviceIds: [8], seasonNumber: 1, episodeNumber, name: `Episode ${episodeNumber}` })), services: [] },
   ].filter(item => item.minutes <= minutes && (!url.searchParams.get("type") || url.searchParams.get("type") === "both" || item.mediaType === url.searchParams.get("type"))) }); return;
  }
  if (scenario === "issue-fixes" && /^\/shows\/user\/[^/]+\/up-next$/.test(url.pathname)) {
   json({ page: 1, pageSize: 20, total: 6, totalPages: 1, hasNextPage: false, hasPreviousPage: false, items: Array.from({ length: 6 }, (_, index) => ({ showId: String(1399 + index), totalEpisodes: 20, episodesWatched: 5, latestWatchedDate: "2026-10-15T12:00:00.000Z", lastWatched: { seasonNumber: 1, episodeNumber: 5 }, nextEpisode: { seasonNumber: 1, episodeNumber: 6, name: `The next chapter ${index + 1}`, airDate: "2026-01-01", overview: "The story continues with a new discovery and an unexpected visitor." }, show: { showId: String(1399 + index), title: `Local fixture show ${index + 1}`, posterPath: "/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg", backdropPath: "/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg", overview: "A synthetic show for layout verification." } })) }); return;
  }
  if (url.pathname === "/trakt-sync") {
			json(
				["trakt-sync-catch-up", "trakt-sync-error", "trakt-sync-attention", "trakt-sync-lists", "trakt-sync-recovery", "issue-fixes"].includes(scenario)
					? {
							...sample(spec.components.schemas.SyncStatusDto),
							configured: true,
							status: scenario === "trakt-sync-error" ? "preparing" : scenario === "trakt-sync-lists" ? "paused" : "active",
							lastError: scenario === "trakt-sync-error" ? "Trakt could not finish the request. Your data is retained; sync will retry." : undefined,
							username: "fixture",
 syncState: fixtureSyncState,
 publicationConsent: true,
 listPublicationConsent: true,
 needsAttention: scenario === "trakt-sync-attention" || (scenario === "trakt-sync-recovery" && fixtureIssue && !fixtureIgnored) ? 1 : 0,
 ignored: scenario === "trakt-sync-recovery" && fixtureIssue && fixtureIgnored ? 1 : 0,
							direction: "inbound",
							watches: true,
							ratings: true,
							lists: ["trakt-sync-lists", "issue-fixes"].includes(scenario),
							watchlist: ["trakt-sync-lists", "issue-fixes"].includes(scenario),
       favorites: scenario === "issue-fixes",
       notes: scenario === "issue-fixes",
       library: scenario === "issue-fixes",
       reviews: scenario === "issue-fixes",
							historyScope: "all",
							remaining: scenario === "trakt-sync-catch-up" ? 15 : 0,
							progress: 40,
						}
					: { configured: false, connected: false },
			);
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
		if (url.pathname === "/shows/tmdb/1399") {
			json({ ...sample(spec.components.schemas.TMDBShowDetailDto), id: 1399, name: "Local fixture show", overview: "A synthetic show for checking season navigation.", first_air_date: "2020-01-01", number_of_episodes: 2, number_of_seasons: 1, seasons: [{ id: 1, season_number: 1, name: "Season 1", episode_count: 2 }], credits: { cast: [], crew: [], cast_total: 0, crew_total: 0 } }); return;
		}
		if (url.pathname === "/shows/tmdb/1399/season/1") {
			json({ ...sample(spec.components.schemas.TMDBSeasonDetailDto), id: 1, name: "Season 1", season_number: 1, overview: "Two fixture episodes", episodes: [1, 2].map(number => ({ id: number, name: `Episode ${number}`, episode_number: number, season_number: 1, air_date: "2020-01-01", overview: "Fixture episode", runtime: 30, vote_average: 7, vote_count: 1, crew: [], guest_stars: [] })) }); return;
		}
		if (url.pathname === "/shows/tmdb/1399/season/1/episode/1") {
			json({ ...sample(spec.components.schemas.TMDBEpisodeDto), id: 1, name: "Episode 1", season_number: 1, episode_number: 1, air_date: "2020-01-01", runtime: 30, overview: "A fixture episode with a full guest cast.", crew: [], guest_stars: Array.from({ length: 8 }, (_, index) => ({ id: index + 1, name: `Guest ${index + 1}`, character: `Character ${index + 1}` })) }); return;
		}
		if (decodeURIComponent(url.pathname) === `/users/${user.did}/shelf`) {
			json({ ...sample(spec.components.schemas.ShelfResponseDto), page: 1, pageSize: 20, total: 2, totalPages: 1, hasPreviousPage: false, hasNextPage: false, items: [1, 2].map(index => ({ id: `fixture-${index}`, type: "movie", movieId: String(index), title: `Fixture film ${index}`, watchCount: 1, watchedDate: `2026-10-${index === 1 ? "15" : "14"}T12:00:00.000Z`, createdAt: "2026-10-15T12:00:00.000Z" })) }); return;
		}
		if (url.pathname === "/users/synthetic.test/profile") {
			json({ ...sample(spec.components.schemas.PublicUserProfileDto), ...user, watchesPublic: true }); return;
		}
		const route = Object.keys(spec.paths).find(path => path.split("/").length === url.pathname.split("/").length && path.split("/").every((part, index) => part.startsWith("{") || part === url.pathname.split("/")[index]));
		const operation = spec.paths[route]?.[req.method.toLowerCase()];
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
