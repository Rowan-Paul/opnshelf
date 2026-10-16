import { test } from "node:test";
import assert from "node:assert/strict";
import { createScenarioServer } from "./ui-scenarios.mjs";

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
