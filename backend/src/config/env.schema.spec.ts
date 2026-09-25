import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { environmentTable, parseEnvironment } from "./env.schema";

const privateKey = generateKeyPairSync("ec", { namedCurve: "P-256" })
	.privateKey.export({ type: "pkcs8", format: "pem" })
	.toString();
const production = {
	NODE_ENV: "production",
	DATABASE_URL: "postgresql://user:secret@localhost:5432/test",
	TMDB_API_KEY: "tmdb-test-key",
	PDS_URL: "https://pds.example.com",
	PDS_HANDLE_DOMAIN: "example.com",
	PDS_ADMIN_IDENTIFIER: "admin.example.com",
	PDS_ADMIN_PASSWORD: "test-password",
	BACKEND_PUBLIC_URL: "https://api.example.com",
	FRONTEND_URL: "https://example.com",
	TAB_URL: "http://tab:2480",
	TAB_ADMIN_PASSWORD: "test-password",
	GOOGLE_CLIENT_ID: "test-client-id",
	GOOGLE_CLIENT_SECRET: "test-client-secret",
	APPLE_CLIENT_ID: "example.signin",
	APPLE_TEAM_ID: "ABCDEFGHIJ",
	APPLE_KEY_ID: "0123456789",
	APPLE_PRIVATE_KEY: privateKey,
	PROVIDER_STATE_SECRET: "test-provider-state-secret-at-least-32-characters",
	TURNSTILE_SECRET_KEY: "test-turnstile-key",
	CLOUDFLARE_API_TOKEN: "test-cloudflare-token",
	CLOUDFLARE_ACCOUNT_ID: "test-cloudflare-account",
	TRAKT_API_KEY: "test-trakt-key",
};

describe("backend environment", () => {
	it("requires production integrations while keeping Redis and opt-in SSR optional", () => {
		expect(parseEnvironment(production)).toMatchObject({
			NODE_ENV: "production",
			PORT: 3001,
		});
		expect(() =>
			parseEnvironment({
				...production,
				TMDB_API_KEY: undefined,
				APPLE_CLIENT_ID: " ",
			}),
		).toThrow(
			"Invalid backend environment (missing or invalid): APPLE_CLIENT_ID, TMDB_API_KEY",
		);
	});

	it("preserves local disabled integrations and normalizes typed settings", () => {
		expect(
			parseEnvironment({
				REDIS_URL: "",
				PORT: "4500",
				PDS_MAINTENANCE_MODE: " YES ",
				PDS_MAINTENANCE_RETRY_AFTER_SECONDS: "120",
			}),
		).toMatchObject({
			NODE_ENV: "development",
			PORT: 4500,
			PDS_MAINTENANCE_MODE: true,
			PDS_MAINTENANCE_RETRY_AFTER_SECONDS: 120,
		});
		expect(parseEnvironment({}).PDS_MAINTENANCE_MODE).toBe(false);
	});

	it.each([
		["NODE_ENV", "prod-secret"],
		["PORT", "65536"],
		["PORT", "0"],
		["PORT", "3.5"],
		["DATABASE_URL", "https://secret.example.com"],
		["REDIS_URL", "https://secret.example.com"],
		["BACKEND_PUBLIC_URL", "not-a-url-secret"],
		["FRONTEND_URL", "ftp://secret.example.com"],
		["PDS_HANDLE_DOMAIN", "https://secret.example.com"],
		["TAB_URL", "invalid-secret"],
		["SSR_RATE_LIMIT_SECRET", "short-secret"],
		["PROVIDER_STATE_SECRET", "short-secret"],
		["APPLE_PRIVATE_KEY", "invalid-private-key-secret"],
		["APPLE_TEAM_ID", "short"],
		["PDS_MAINTENANCE_MODE", "enabled-secret"],
		["PDS_MAINTENANCE_RETRY_AFTER_SECONDS", "-1"],
		["FEEDBACK_GITHUB_REPOSITORY", "invalid repository secret"],
	])("rejects malformed %s without revealing its value", (name, value) => {
		try {
			parseEnvironment({ [name]: value });
			throw new Error("Validation unexpectedly passed");
		} catch (error) {
			expect((error as Error).message).toBe(
				`Invalid backend environment (missing or invalid): ${name}`,
			);
			expect((error as Error).message).not.toContain(value);
		}
	});

	it("accepts escaped Apple PEM newlines and rejects the wrong signing curve", () => {
		expect(
			parseEnvironment({ APPLE_PRIVATE_KEY: privateKey.replace(/\n/g, "\\n") })
				.APPLE_PRIVATE_KEY,
		).toBe(privateKey);
		const key = generateKeyPairSync("ec", { namedCurve: "P-384" })
			.privateKey.export({ type: "pkcs8", format: "pem" })
			.toString();
		expect(() => parseEnvironment({ APPLE_PRIVATE_KEY: key })).toThrow(
			"APPLE_PRIVATE_KEY",
		);
	});

	it("accepts legacy Tab names for one release, with canonical precedence and value-free warnings", () => {
		const warn = vi.fn();
		const env = parseEnvironment(
			{
				...production,
				TAB_URL: "",
				TAB_ADMIN_PASSWORD: undefined,
				TAP_URL: "http://legacy:2480",
				TAP_ADMIN_PASSWORD: "legacy-secret",
			},
			warn,
		);
		expect(env.TAB_URL).toBe("http://legacy:2480");
		expect(env.TAB_ADMIN_PASSWORD).toBe("legacy-secret");
		expect(env).not.toHaveProperty("TAP_URL");
		expect(warn).toHaveBeenCalledTimes(2);
		expect(warn.mock.calls.flat().join(" ")).not.toContain("legacy-secret");
		expect(warn.mock.calls.flat().join(" ")).not.toContain("http://legacy");
		expect(
			parseEnvironment({ ...production, TAP_URL: "http://legacy:2480" }, warn)
				.TAB_URL,
		).toBe(production.TAB_URL);
	});

	it("fails before Nest boot and loads .env before validation without replacing deployment values", () => {
		const directory = mkdtempSync(resolve(tmpdir(), "opnshelf-env-"));
		const register = require.resolve("ts-node/register/transpile-only");
		const main = resolve("src/main.ts");
		const envModule = resolve("src/config/env.ts");
		const options = {
			cwd: directory,
			timeout: 10_000,
			encoding: "utf8" as const,
			env: {
				PATH: process.env.PATH,
				TS_NODE_PROJECT: resolve("tsconfig.json"),
				NODE_ENV: "production",
			},
		};
		try {
			const result = spawnSync(
				process.execPath,
				["-r", register, main],
				options,
			);
			expect(result.status).not.toBe(0);
			expect(result.stderr).toContain(
				"Invalid backend environment (missing or invalid):",
			);
			expect(result.stderr).toContain("DATABASE_URL");
			expect(result.stderr).toContain("TMDB_API_KEY");
			expect(result.stdout).not.toContain("Starting Nest");
			writeFileSync(
				resolve(directory, ".env"),
				"NODE_ENV=development\nPORT=4567\n",
			);
			const loaded = spawnSync(
				process.execPath,
				[
					"-r",
					register,
					"-e",
					`console.log(require(${JSON.stringify(envModule)}).env.PORT)`,
				],
				{ ...options, env: { ...options.env, NODE_ENV: "test", PORT: "5678" } },
			);
			expect(loaded.status).toBe(0);
			expect(loaded.stdout.trim()).toBe("5678");
			const fromFile = spawnSync(
				process.execPath,
				[
					"-r",
					register,
					"-e",
					`console.log(require(${JSON.stringify(envModule)}).env.PORT)`,
				],
				{
					...options,
					env: {
						PATH: process.env.PATH,
						TS_NODE_PROJECT: resolve("tsconfig.json"),
					},
				},
			);
			expect(fromFile.status).toBe(0);
			expect(fromFile.stdout.trim()).toBe("4567");
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it("keeps the README table identical to the schema", () => {
		const readme = readFileSync(resolve("../README.md"), "utf8");
		expect(
			readme
				.split("<!-- backend-env:start -->\n")[1]
				?.split("\n<!-- backend-env:end -->")[0],
		).toBe(environmentTable());
	});
});
