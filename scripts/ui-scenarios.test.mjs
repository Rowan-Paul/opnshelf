import { test } from "node:test";
import assert from "node:assert/strict";
import { createScenarioServer } from "./ui-scenarios.mjs";

test("issue fixtures exercise populated layouts and picker empty results without onboarding", async () => {
 const server = createScenarioServer("issue-fixes");
 await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
 const base = `http://127.0.0.1:${server.address().port}`;
 const read = async path => (await fetch(`${base}${path}`)).json();
 try {
  assert.equal((await read("/auth/me")).needsOnboarding, false);
  assert.equal((await read("/watch-picker?minutes=120")).items.length, 2);
  assert.equal((await read("/watch-picker?minutes=120&type=movie")).items.length, 1);
  assert.equal((await read("/watch-picker?minutes=15")).items.length, 0);
  assert.equal((await read("/shows/user/synthetic.test/up-next")).items.length, 6);
  assert.equal((await read("/trakt-sync")).reviews, true);
 } finally { await new Promise(resolve => server.close(resolve)); }
});

test("local scenarios reset failures and never proxy unknown or cross-origin requests", async () => {
	const server = createScenarioServer("failed-settings");
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const base = `http://127.0.0.1:${server.address().port}`;
	try {
		assert.equal((await fetch(`${base}/users/me/settings`)).status, 503);
		await fetch(`${base}/__scenario`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ scenario: "conflict" }),
		});
		assert.equal(
			(await fetch(`${base}/users/me/privacy/change`, { method: "POST" }))
				.status,
			409,
		);
		assert.equal((await fetch(`${base}/users/me/settings`)).status, 200);
		await fetch(`${base}/users/me/onboarding/complete`, { method: "POST" });
		const before = await (await fetch(`${base}/auth/me`)).json();
		assert.equal(before.needsOnboarding, false);
		assert.equal(
			(await fetch(`${base}/users/me/onboarding/reset`, { method: "POST" })).status,
			204,
		);
		const after = await (await fetch(`${base}/auth/me`)).json();
		assert.deepEqual(after, {
			...before,
			needsOnboarding: true,
			onboardingCompletedAt: null,
		});
		assert.equal((await fetch(`${base}/unknown`)).status, 404);
		assert.equal(
			(
				await fetch(`${base}/auth/me`, {
					headers: { origin: "https://opnshelf.xyz" },
				})
			).status,
			403,
		);
		assert.equal(
			(
				await fetch(`${base}/__scenario`, {
					method: "POST",
					body: '{"scenario":"unknown"}',
				})
			).status,
			400,
		);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
});

 test("Trakt recovery fixtures show verification and running state, and reset cleanly", async () => {
 const server = createScenarioServer("trakt-sync-recovery");
 await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
 const base = `http://127.0.0.1:${server.address().port}`;
 const read = async path => (await fetch(`${base}${path}`)).json();
 try {
  assert.equal((await read("/trakt-sync/issues")).items[0].traktState, "unknown");
  await fetch(`${base}/trakt-sync/issues/uncertain`, { method: "POST", body: '{"action":"ignore"}' });
  assert.equal((await read("/trakt-sync/issues?view=attention")).total, 0);
  assert.equal((await read("/trakt-sync/issues?view=ignored")).items[0].ignored, true);
  assert.equal((await read("/trakt-sync")).ignored, 1);
  await fetch(`${base}/trakt-sync/issues/uncertain`, { method: "POST", body: '{"action":"undo"}' });
  assert.equal((await read("/trakt-sync/issues?view=ignored")).total, 0);
  assert.equal((await read("/trakt-sync/issues?view=attention")).total, 1);
  await fetch(`${base}/trakt-sync/action`, { method: "POST", body: '{"action":"sync"}' });
  assert.equal((await read("/trakt-sync")).syncState, "running");
  await fetch(`${base}/trakt-sync/issues/uncertain`, { method: "POST", body: '{"action":"retry"}' });
  assert.equal((await read("/trakt-sync/issues")).total, 0);
  await fetch(`${base}/__scenario`, { method: "POST", body: '{"scenario":"trakt-sync-recovery"}' });
  assert.equal((await read("/trakt-sync")).syncState, "idle");
  assert.equal((await read("/trakt-sync/issues")).total, 1);
 } finally { await new Promise(resolve => server.close(resolve)); }
 });

test("native tab fixtures cover signed-out, gated and avatar sessions", async () => {
 const server = createScenarioServer("native-tabs-guest");
 await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
 const base = `http://127.0.0.1:${server.address().port}`;
 const change = scenario => fetch(`${base}/__scenario`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenario }) });
 try {
  assert.equal((await fetch(`${base}/auth/me`)).status, 401);
  await change("native-tabs-verify");
  const gated = await (await fetch(`${base}/auth/me`)).json();
  assert.equal(gated.needsEmailVerification, true);
  assert.equal(gated.needsOnboarding, true);
  await change("native-tabs-avatar");
  const member = await (await fetch(`${base}/auth/me`)).json();
  assert.equal(member.needsOnboarding, false);
  assert.equal(member.avatar, "http://127.0.0.1:3391/__avatar");
  const image = await fetch(`${base}/__avatar`);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.deepEqual([...new Uint8Array(await image.arrayBuffer()).slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
 } finally { await new Promise(resolve => server.close(resolve)); }
});

test("sync review queue pages single episodes and advances after resolution", async () => {
	const server = createScenarioServer("trakt-sync-attention");
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const base = `http://127.0.0.1:${server.address().port}`;
	const read = async (page) =>
		(
			await fetch(
				`${base}/trakt-sync/issues?view=attention&page=${page}&pageSize=1`,
			)
		).json();
	try {
		const first = await read(1);
		assert.equal(first.items.length, 1);
		assert.equal(first.total, 3);
		assert.equal(first.items[0].trakt.episode, 1);
		assert.equal((await read(2)).items[0].trakt.episode, 2);
		await fetch(`${base}/trakt-sync/issues/episode-1`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ action: "link", candidateKey: "local-episode-1" }),
		});
		assert.equal((await read(1)).items[0].trakt.episode, 2);
		await fetch(`${base}/trakt-sync/issues/episode-3`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ action: "ignore" }),
		});
		const last = await read(2);
		assert.equal(last.page, 1);
		assert.equal(last.total, 1);
		assert.equal(last.items[0].trakt.episode, 2);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
});
