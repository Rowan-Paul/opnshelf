import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createLighthouseServer } from "./lighthouse-fixtures.mjs";
import { validateReport } from "./lighthouse.mjs";
import {
	pages,
	webOrigin,
	apiOrigin,
	checkContent,
} from "./lighthouse-pages.cjs";

test("report validation rejects a mismatched or missing Lighthouse version", () => {
	for (const lighthouseVersion of ["12.6.1", undefined]) {
		assert.throws(
			() => validateReport({ lighthouseVersion }),
			/Report Lighthouse version must match the dashboard renderer/,
		);
	}
});

test("Lighthouse fixture requires its synthetic session, provides populated data, and rejects unexpected traffic", async () => {
	const { server, errors } = createLighthouseServer();
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const base = `http://127.0.0.1:${server.address().port}`;
	try {
		assert.equal((await fetch(`${base}/auth/me`)).status, 401);
		const user = await (
			await fetch(`${base}/auth/me`, {
				headers: {
					cookie: "opnshelf_session=lighthouse-fixture-only",
					origin: webOrigin,
				},
			})
		).json();
		assert.equal(user.needsOnboarding, false);
		const shelf = await (await fetch(`${base}/users/${user.did}/shelf`)).json();
		assert.equal(shelf.items.length, 12);
		assert(shelf.items.every((item) => item.posterPath && item.watchedDate));
		assert.equal(
			(
				await fetch(`${base}/auth/me`, {
					headers: { origin: "https://example.com" },
				})
			).status,
			403,
		);
		// Even a valid OpenAPI path must be explicitly supplied, not sampled empty.
		assert.equal((await fetch(`${base}/movies/tmdb/123`)).status, 404);
		assert.equal(
			(await fetch(`${base}/movies/watched`, { method: "POST" })).status,
			405,
		);
		assert.equal(errors.length, 2);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
});

test("measured content audit rejects public, redirected and skeleton pages", () => {
	const page = pages[0];
	const content = {
		url: webOrigin + page.path,
		text: page.text.join(" "),
		ownProfile: true,
	};
	assert.equal(checkContent(content).score, 1);
	for (const invalid of [
		{ ...content, text: "" },
		{ ...content, url: webOrigin + "/login" },
		{ ...content, ownProfile: false },
	]) {
		assert.equal(checkContent(invalid).score, 0);
	}
});

test("report validation requires authentication during measurement and populated content", () => {
	const url = webOrigin + pages[0].path;
	const report = {
		lighthouseVersion: "13.5.0",
		requestedUrl: url,
		finalDisplayedUrl: url,
		audits: {
			"authenticated-content": { score: 1 },
			"network-requests": {
				details: {
					items: [
						{ url: apiOrigin + "/auth/me", statusCode: 200 },
						{ url: apiOrigin + "/social/feed", statusCode: 200 },
					],
				},
			},
		},
	};
	assert.equal(validateReport(report).name, "Home");
	assert.throws(
		() =>
			validateReport({ ...report, finalDisplayedUrl: webOrigin + "/login" }),
		/redirected/,
	);
	const missingSession = structuredClone(report);
	missingSession.audits["network-requests"].details.items.shift();
	assert.throws(() => validateReport(missingSession), /did not authenticate/);
	const blank = structuredClone(report);
	blank.audits["authenticated-content"].score = 0;
	assert.throws(() => validateReport(blank), /content audit/);
});

test("image readiness retries a connection reset while the server starts", async () => {
	const workflow = readFileSync(
		new URL("../.github/workflows/ci.yml", import.meta.url),
		"utf8",
	);
	const command = workflow.match(
		/^\s*(curl --fail --retry .*\/healthz)$/m,
	)?.[1];
	assert(command, "Workflow readiness command missing");
	let requests = 0;
	const server = createServer((socket) => {
		socket.on("error", () => {});
		socket.once("data", () => {
			requests++;
			if (requests === 1) socket.resetAndDestroy();
			else
				socket.end(
					"HTTP/1.1 200 OK\r\nContent-Length: 7\r\nConnection: close\r\n\r\nhealthy",
				);
		});
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	try {
		const args = command.trim().split(/\s+/).slice(1);
		args[args.length - 1] = `http://127.0.0.1:${server.address().port}/healthz`;
		const { stdout } = await promisify(execFile)("curl", args, {
			timeout: 10000,
		});
		assert.equal(stdout, "healthy");
		assert.equal(requests, 2);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
});
