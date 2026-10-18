import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serverOptions, startServer } from "./index.mjs";

const password = "local-integration-fixture-only-123456789";

test("dashboard refuses to start without configured authentication", () => {
	for (const env of [
		{},
		{ LHCI_BASIC_AUTH_PASSWORD: "" },
		{ LHCI_BASIC_AUTH_PASSWORD: "short" },
	]) {
		assert.throws(() => serverOptions(env), /LHCI_BASIC_AUTH_PASSWORD/);
	}
	assert.throws(
		() =>
			serverOptions({
				LHCI_BASIC_AUTH_PASSWORD: password,
				LHCI_STORAGE_PATH: "./db",
			}),
		/absolute/,
	);
});

test("health is public, reports require authentication, and project history survives a restart", async () => {
	const directory = await mkdtemp(join(tmpdir(), "opnshelf-lhci-"));
	const env = {
		PORT: "0",
		LHCI_HOST: "127.0.0.1",
		LHCI_BASIC_AUTH_PASSWORD: password,
		LHCI_STORAGE_PATH: join(directory, "lhci.db"),
	};
	const headers = {
		authorization: `Basic ${Buffer.from(`opnshelf:${password}`).toString("base64")}`,
		"content-type": "application/json",
	};
	let server;
	try {
		server = await startServer(env);
		const base = `http://127.0.0.1:${server.port}`;
		assert.equal((await fetch(`${base}/healthz`)).status, 200);
		for (const path of ["/app/", "/version", "/v1/projects"])
			assert.equal((await fetch(base + path)).status, 401);
		assert.equal((await fetch(`${base}/app/`, { headers })).status, 200);
		const response = await fetch(`${base}/v1/projects`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				name: "Opnshelf CI fixture",
				slug: "",
				externalUrl: "https://example.test/repository",
				baseBranch: "develop",
			}),
		});
		assert.equal(response.status, 200);
		const project = await response.json();
		assert(project.id && project.token);
		assert.equal(
			(
				await fetch(`${base}/v1/projects/${project.id}/builds`, {
					method: "POST",
					headers,
					body: "{}",
				})
			).status,
			403,
		);
		await server.close();
		server = undefined;
		server = await startServer(env);
		const projects = await (
			await fetch(`http://127.0.0.1:${server.port}/v1/projects`, { headers })
		).json();
		assert.equal(projects.length, 1);
		assert.equal(projects[0].id, project.id);
		assert.equal(projects[0].baseBranch, "develop");
		assert.equal(projects[0].token, "");
		assert.equal(projects[0].adminToken, "");
	} finally {
		await server?.close();
		await rm(directory, { recursive: true, force: true });
	}
});
