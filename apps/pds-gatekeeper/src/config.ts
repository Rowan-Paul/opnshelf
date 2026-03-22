import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface GatekeeperConfig {
	host: string;
	port: number;
	pdsBaseUrl: string;
	pdsHostname: string;
	enableSignupProtection: boolean;
	signupCodeTtlSeconds: number;
	turnstileSiteKey: string;
	turnstileSecretKey: string;
	turnstileExpectedHostname: string;
	turnstileExpectedAction: string;
	defaultCaptchaRedirect: string;
	allowedCaptchaRedirects: string[];
	dbPath: string;
}

function readEnv(name: string): string {
	const value = process.env[name];
	if (!value || value.trim() === "") {
		throw new Error(`${name} is required`);
	}
	return value.trim();
}

function readOptionalEnv(name: string, fallback: string): string {
	const value = process.env[name];
	return value && value.trim() !== "" ? value.trim() : fallback;
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
	const value = process.env[name];
	if (value === undefined) {
		return fallback;
	}

	return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readIntegerEnv(name: string, fallback: number): number {
	const raw = process.env[name];
	if (raw === undefined) {
		return fallback;
	}

	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`${name} must be a positive integer`);
	}
	return parsed;
}

function normalizeBaseUrl(url: string): string {
	return url.endsWith("/") ? url.slice(0, -1) : url;
}

function parseRedirects(csv: string, defaultRedirect: string): string[] {
	const values = csv
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);

	if (values.length === 0) {
		return [defaultRedirect];
	}

	if (!values.includes(defaultRedirect)) {
		values.unshift(defaultRedirect);
	}

	return values;
}

export function loadConfig(): GatekeeperConfig {
	const pdsBaseUrl = normalizeBaseUrl(readEnv("PDS_BASE_URL"));
	const pdsHostname = readEnv("PDS_HOSTNAME");
	const defaultCaptchaRedirect = readOptionalEnv(
		"GATEKEEPER_DEFAULT_CAPTCHA_REDIRECT",
		"https://bsky.app",
	);
	const dbPath = readOptionalEnv(
		"GATEKEEPER_DB_PATH",
		"/data/gatekeeper.sqlite",
	);

	mkdirSync(dirname(dbPath), { recursive: true });

	const config: GatekeeperConfig = {
		host: readOptionalEnv("HOST", "0.0.0.0"),
		port: readIntegerEnv("PORT", 8080),
		pdsBaseUrl,
		pdsHostname,
		enableSignupProtection: readBooleanEnv(
			"GATEKEEPER_ENABLE_SIGNUP_PROTECTION",
			true,
		),
		signupCodeTtlSeconds: readIntegerEnv(
			"GATEKEEPER_SIGNUP_CODE_TTL_SECONDS",
			300,
		),
		turnstileSiteKey: readEnv("TURNSTILE_SITE_KEY"),
		turnstileSecretKey: readEnv("TURNSTILE_SECRET_KEY"),
		turnstileExpectedHostname: readOptionalEnv(
			"TURNSTILE_EXPECTED_HOSTNAME",
			pdsHostname,
		),
		turnstileExpectedAction: readOptionalEnv(
			"TURNSTILE_EXPECTED_ACTION",
			"signup",
		),
		defaultCaptchaRedirect,
		allowedCaptchaRedirects: parseRedirects(
			readOptionalEnv(
				"GATEKEEPER_CAPTCHA_SUCCESS_REDIRECTS",
				defaultCaptchaRedirect,
			),
			defaultCaptchaRedirect,
		),
		dbPath,
	};

	return config;
}
