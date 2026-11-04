// Release credential preflight: before a release queues native builds or
// uploads Web source maps, prove each upload/build credential in this
// environment still authenticates. A rotated key that missed one of its copies
// otherwise surfaces only at the end of an expensive build (2026-11-02: both
// store builds failed on a stale EAS POSTHOG_CLI_API_KEY).
//
// Each check makes the cheapest authenticated read. Output is the credential
// name and a status, never the value or a response body. Exits 1 only on a
// credential the service rejects; an unset credential or an unreachable
// service is reported and left to the step that needs it.
//
// Usage: node scripts/release-preflight.mjs [VARIABLE...]
// With variable names, only those credentials are checked.
//
// Where every copy lives: docs/runbooks/credential-rotation.md.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TIMEOUT_MS = 10_000;

async function request(fetchImpl, url, init) {
	try {
		const response = await fetchImpl(url, {
			...init,
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		let body = null;
		try {
			body = await response.json();
		} catch {}
		return { status: response.status, body };
	} catch (error) {
		return { error: error?.name ?? "network error" };
	}
}

function unchecked(result) {
	return {
		status: "unchecked",
		detail: result.error ?? `HTTP ${result.status}`,
	};
}

export const checks = [
	{
		name: "PostHog source map upload key",
		variable: "POSTHOG_CLI_API_KEY",
		async verify(env, fetchImpl) {
			const host = (env.POSTHOG_CLI_HOST || "https://eu.posthog.com").replace(
				/\/+$/,
				"",
			);
			const project = env.POSTHOG_CLI_PROJECT_ID;
			const url = project
				? `${host}/api/projects/${encodeURIComponent(project)}/`
				: `${host}/api/users/@me/`;
			const result = await request(fetchImpl, url, {
				headers: { authorization: `Bearer ${env.POSTHOG_CLI_API_KEY}` },
			});
			if (result.error) return unchecked(result);
			if (result.status >= 200 && result.status < 300)
				return { status: "ok" };
			if (result.status === 401)
				return { status: "invalid", detail: "PostHog rejected the key" };
			// An upload-only key may lack read scopes; PostHog still authenticated it.
			if (
				result.status === 403 &&
				/scope/i.test(String(result.body?.detail ?? ""))
			)
				return { status: "ok", detail: "authenticated; no read scope" };
			if (result.status === 403 || result.status === 404)
				return {
					status: "invalid",
					detail: "key cannot access POSTHOG_CLI_PROJECT_ID",
				};
			return unchecked(result);
		},
	},
	{
		name: "Expo access token",
		variable: "EXPO_TOKEN",
		async verify(env, fetchImpl) {
			const result = await request(fetchImpl, "https://api.expo.dev/graphql", {
				method: "POST",
				headers: {
					authorization: `Bearer ${env.EXPO_TOKEN}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({ query: "{ meActor { id } }" }),
			});
			if (result.error) return unchecked(result);
			if (result.status === 401 || result.status === 403)
				return { status: "invalid", detail: "Expo rejected the token" };
			if (result.status >= 200 && result.status < 300)
				return result.body?.data?.meActor?.id
					? { status: "ok" }
					: { status: "invalid", detail: "token resolves to no account" };
			return unchecked(result);
		},
	},
];

export async function preflight(
	env,
	fetchImpl = globalThis.fetch,
	only = [],
) {
	const results = [];
	for (const check of checks) {
		if (only.length && !only.includes(check.variable)) continue;
		const base = { name: check.name, variable: check.variable };
		if (!env[check.variable]) {
			results.push({ ...base, status: "not set" });
			continue;
		}
		results.push({ ...base, ...(await check.verify(env, fetchImpl)) });
	}
	return results;
}

export function formatResult({ name, variable, status, detail }) {
	return `${name} (${variable}): ${status}${detail ? ` (${detail})` : ""}`;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const only = process.argv.slice(2);
	const unknown = only.filter((v) => !checks.some((c) => c.variable === v));
	if (unknown.length) {
		console.error(`Unknown credential: ${unknown.join(", ")}`);
		process.exit(2);
	}
	const results = await preflight(process.env, globalThis.fetch, only);
	for (const result of results) console.log(formatResult(result));
	if (results.some((result) => result.status === "invalid")) {
		console.error(
			"Rotate the rejected credential in every place listed in docs/runbooks/credential-rotation.md, then rerun.",
		);
		process.exitCode = 1;
	}
}
