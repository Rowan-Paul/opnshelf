import { test } from "node:test";
import assert from "node:assert/strict";
import { formatResult, preflight } from "./release-preflight.mjs";

const SECRET = "phx_do-not-print-me";
const TOKEN = "expo-do-not-print-me";

function fakeFetch(routes) {
	const calls = [];
	const impl = async (url, init) => {
		calls.push({ url, init });
		const route = routes.find(([prefix]) => url.startsWith(prefix));
		if (!route) throw new Error(`unexpected ${url}`);
		const [, respond] = route;
		const { status, body } = await respond(url, init);
		return { status, json: async () => body };
	};
	return { impl, calls };
}

const byVariable = (results) =>
	Object.fromEntries(results.map((r) => [r.variable, r]));

test("reports every credential as not set without calling out", async () => {
	const { impl, calls } = fakeFetch([]);
	const results = await preflight({}, impl);
	assert.deepEqual(
		results.map((r) => r.status),
		["not set", "not set"],
	);
	assert.equal(calls.length, 0);
});

test("authenticates each credential with a read call", async () => {
	const { impl, calls } = fakeFetch([
		["https://eu.posthog.com/api/projects/123/", () => ({ status: 200 })],
		[
			"https://api.expo.dev/graphql",
			() => ({ status: 200, body: { data: { meActor: { id: "a" } } } }),
		],
	]);
	const results = byVariable(
		await preflight(
			{
				POSTHOG_CLI_API_KEY: SECRET,
				POSTHOG_CLI_PROJECT_ID: "123",
				EXPO_TOKEN: TOKEN,
			},
			impl,
		),
	);
	assert.equal(results.POSTHOG_CLI_API_KEY.status, "ok");
	assert.equal(results.EXPO_TOKEN.status, "ok");
	assert.equal(calls[0].init.headers.authorization, `Bearer ${SECRET}`);
	assert.equal(calls[1].init.headers.authorization, `Bearer ${TOKEN}`);
});

test("flags rejected credentials as invalid without echoing them", async () => {
	const { impl } = fakeFetch([
		[
			"https://us.posthog.com/api/users/@me/",
			() => ({ status: 401, body: { detail: "invalid" } }),
		],
		[
			"https://api.expo.dev/graphql",
			() => ({ status: 401, body: { errors: [] } }),
		],
	]);
	const results = await preflight(
		{
			POSTHOG_CLI_API_KEY: SECRET,
			POSTHOG_CLI_HOST: "https://us.posthog.com/",
			EXPO_TOKEN: TOKEN,
		},
		impl,
	);
	assert.deepEqual(
		results.map((r) => r.status),
		["invalid", "invalid"],
	);
	const printed = results.map(formatResult).join("\n");
	assert.ok(!printed.includes(SECRET));
	assert.ok(!printed.includes(TOKEN));
});

test("tells a scope-limited PostHog key from one without project access", async () => {
	const posthog = (detail, status = 403) =>
		fakeFetch([
			["https://eu.posthog.com/", () => ({ status, body: { detail } })],
		]).impl;
	const env = { POSTHOG_CLI_API_KEY: SECRET, POSTHOG_CLI_PROJECT_ID: "9" };
	const status = async (impl) => (await preflight(env, impl))[0].status;
	assert.equal(
		await status(posthog("API key missing required scope 'project:read'")),
		"ok",
	);
	assert.equal(
		await status(posthog("You don't have access to the project.")),
		"invalid",
	);
	assert.equal(await status(posthog("Not found.", 404)), "invalid");
});

test("checks only the named credentials when given a list", async () => {
	const { impl, calls } = fakeFetch([]);
	const results = await preflight({ EXPO_TOKEN: TOKEN }, impl, [
		"POSTHOG_CLI_API_KEY",
	]);
	assert.deepEqual(
		results.map((r) => [r.variable, r.status]),
		[["POSTHOG_CLI_API_KEY", "not set"]],
	);
	assert.equal(calls.length, 0);
});

test("an Expo token that resolves to no account is invalid", async () => {
	const { impl } = fakeFetch([
		[
			"https://api.expo.dev/graphql",
			() => ({ status: 200, body: { data: { meActor: null } } }),
		],
	]);
	const [, expo] = await preflight({ EXPO_TOKEN: TOKEN }, impl);
	assert.equal(expo.status, "invalid");
});

test("an unreachable service or server error is unchecked, not invalid", async () => {
	const { impl } = fakeFetch([
		[
			"https://eu.posthog.com/",
			() => {
				throw Object.assign(new Error("boom"), { name: "TimeoutError" });
			},
		],
		["https://api.expo.dev/graphql", () => ({ status: 503 })],
	]);
	const results = await preflight(
		{ POSTHOG_CLI_API_KEY: SECRET, EXPO_TOKEN: TOKEN },
		impl,
	);
	assert.deepEqual(
		results.map((r) => [r.status, r.detail]),
		[
			["unchecked", "TimeoutError"],
			["unchecked", "HTTP 503"],
		],
	);
});
