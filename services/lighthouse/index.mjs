import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import lhci from "@lhci/server";

export function serverOptions(env = process.env) {
	const username = env.LHCI_BASIC_AUTH_USERNAME || "opnshelf";
	const password = env.LHCI_BASIC_AUTH_PASSWORD;
	assert(
		password?.length >= 32,
		"LHCI_BASIC_AUTH_PASSWORD must contain at least 32 characters",
	);
	assert(
		username && !username.includes(":"),
		"LHCI_BASIC_AUTH_USERNAME must be non-empty and contain no colon",
	);
	const port = Number(env.PORT || 9001);
	assert(
		Number.isInteger(port) && port >= 0 && port <= 65535,
		"PORT must be a valid TCP port",
	);
	const databasePath = env.LHCI_STORAGE_PATH || "/data/lhci.db";
	assert(isAbsolute(databasePath), "LHCI_STORAGE_PATH must be absolute");
	return {
		port,
		host: env.LHCI_HOST || "0.0.0.0",
		logLevel: "silent",
		basicAuth: { username, password },
		storage: {
			storageMethod: "sql",
			sqlDialect: "sqlite",
			sqlDatabasePath: databasePath,
		},
	};
}

export async function startServer(env = process.env) {
	const options = serverOptions(env);
	mkdirSync(dirname(options.storage.sqlDatabasePath), { recursive: true });
	return lhci.createServer(options);
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	startServer()
		.then((server) => {
			console.log(`LHCI listening on port ${server.port}`);
			const stop = () => server.close().then(() => process.exit(0));
			process.once("SIGTERM", stop);
			process.once("SIGINT", stop);
		})
		.catch((error) => {
			console.error(error.message);
			process.exitCode = 1;
		});
}
