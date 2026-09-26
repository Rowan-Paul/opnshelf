import { createPrivateKey } from "node:crypto";
import { z } from "zod";

const text = z.string().min(1);
const httpUrl = z.url({ protocol: /^https?$/ });
const positiveInteger = z.coerce
	.number()
	.int()
	.positive()
	.max(Number.MAX_SAFE_INTEGER);

function production<T extends z.ZodType>(schema: T, purpose: string) {
	return schema.optional().describe(purpose).meta({ productionRequired: true });
}

/** The runtime variable inventory; descriptions also generate the README table. */
export const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development")
		.describe("Runtime mode; defaults to development."),
	PORT: positiveInteger
		.max(65535)
		.default(3001)
		.describe("HTTP listening port; defaults to 3001."),
	DATABASE_URL: production(
		z.url({ protocol: /^postgres(ql)?$/ }),
		"PostgreSQL connection string.",
	),
	TMDB_API_KEY: production(text, "TMDB API key for catalogue reads."),
	PDS_URL: production(httpUrl, "Tranquil Personal Data Server URL."),
	PDS_HANDLE_DOMAIN: production(
		z.hostname(),
		"Handle domain served by the PDS.",
	),
	PDS_ADMIN_IDENTIFIER: production(
		text,
		"PDS admin account used for account management.",
	),
	PDS_ADMIN_PASSWORD: production(text, "PDS admin account password."),
	BACKEND_PUBLIC_URL: production(
		httpUrl,
		"Public API URL for OAuth callbacks and avatars.",
	),
	BACKEND_URL: httpUrl
		.optional()
		.describe("Legacy fallback base URL for avatar links."),
	FRONTEND_URL: production(
		httpUrl,
		"Web origin for CORS, redirects and notification links.",
	),
	TAB_URL: production(
		httpUrl,
		"Tab ingestion service URL; local fallback is http://localhost:2480.",
	),
	TAB_ADMIN_PASSWORD: production(
		text,
		"Tab admin password; must match its container.",
	),
	TAP_URL: httpUrl
		.optional()
		.describe(
			"Deprecated alias for TAB_URL; accepted for one transition release.",
		),
	TAP_ADMIN_PASSWORD: text
		.optional()
		.describe(
			"Deprecated alias for TAB_ADMIN_PASSWORD; accepted for one transition release.",
		),
	REDIS_URL: z
		.url({ protocol: /^rediss?$/ })
		.optional()
		.describe(
			"Optional TMDB cache; absence uses process memory, including on Staging (ADR 0041).",
		),
	GOOGLE_CLIENT_ID: production(
		text,
		"Google OAuth client ID shared with the PDS.",
	),
	GOOGLE_CLIENT_SECRET: production(
		text,
		"Google OAuth client secret shared with the PDS.",
	),
	APPLE_CLIENT_ID: production(text, "Apple Service ID shared with the PDS."),
	APPLE_TEAM_ID: production(
		z.string().regex(/^[A-Z0-9]{10}$/),
		"Apple developer team ID (10 characters).",
	),
	APPLE_KEY_ID: production(
		z.string().regex(/^[A-Z0-9]{10}$/),
		"Apple signing key ID (10 characters).",
	),
	APPLE_PRIVATE_KEY: production(
		text
			.transform((value) => value.replace(/\\n/g, "\n"))
			.refine((value) => {
				try {
					const key = createPrivateKey(value);
					return (
						key.asymmetricKeyType === "ec" &&
						key.asymmetricKeyDetails?.namedCurve === "prime256v1"
					);
				} catch {
					return false;
				}
			}),
		"Apple P-256 private signing key; escaped newlines are accepted.",
	),
	PROVIDER_STATE_SECRET: production(
		z.string().min(32),
		"CSRF signing secret for provider callbacks; at least 32 characters.",
	),
	SSR_RATE_LIMIT_SECRET: z
		.string()
		.min(32)
		.optional()
		.describe(
			"Optional Web/API forwarding secret; enable only after trusted-edge verification (ADR 0025).",
		),
	TURNSTILE_SECRET_KEY: production(
		text,
		"Cloudflare Turnstile server secret for signup captcha.",
	),
	CLOUDFLARE_API_TOKEN: production(
		text,
		"Cloudflare Email Sending API token for notifications.",
	),
	CLOUDFLARE_ACCOUNT_ID: production(
		text,
		"Cloudflare account ID for notification delivery.",
	),
	TRAKT_API_KEY: production(text, "Trakt API key for history imports."),
	FEEDBACK_GITHUB_TOKEN: text
		.optional()
		.describe(
			"Optional GitHub token for feedback issues; absent configuration saves feedback only (ADR 0007).",
		),
	FEEDBACK_GITHUB_REPOSITORY: z
		.string()
		.regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
		.optional()
		.describe("Optional owner/repository receiving feedback issues."),
	PDS_MAINTENANCE_MODE: z
		.enum(["1", "true", "yes", "on", "0", "false", "no", "off"])
		.default("false")
		.transform((value) => ["1", "true", "yes", "on"].includes(value))
		.describe(
			"Pause PDS writes and authentication; true/false, 1/0, yes/no or on/off; defaults to false.",
		),
	PDS_MAINTENANCE_RETRY_AFTER_SECONDS: positiveInteger
		.default(300)
		.describe("Maintenance Retry-After header in seconds; defaults to 300."),
});

export type Environment = Omit<
	z.infer<typeof envSchema>,
	"TAP_URL" | "TAP_ADMIN_PASSWORD"
>;

/** Class token lets Nest inject the same typed object without string-keyed reads. */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: Abstract DI token only; EnvModule supplies the validated object through useValue.
export abstract class BackendEnv implements Environment {
	// Properties are inferred from the schema through declaration merging below.
}
export interface BackendEnv extends Environment {}

export function parseEnvironment(
	source: Record<string, string | undefined>,
	warn: (message: string) => void = console.warn,
): Environment {
	const input = Object.fromEntries(
		Object.entries(source).map(([key, value]) => [
			key,
			value?.trim() ? value : undefined,
		]),
	);
	const deprecated: string[] = [];
	for (const [legacy, canonical] of [
		["TAP_URL", "TAB_URL"],
		["TAP_ADMIN_PASSWORD", "TAB_ADMIN_PASSWORD"],
	]) {
		if (input[legacy] !== undefined) {
			deprecated.push(
				`${legacy} is deprecated; use ${canonical} (legacy support ends after the transition release).`,
			);
			input[canonical] ??= input[legacy];
		}
	}
	if (input.PDS_MAINTENANCE_MODE)
		input.PDS_MAINTENANCE_MODE =
			input.PDS_MAINTENANCE_MODE.trim().toLowerCase();
	const result = envSchema.safeParse(input);
	const invalid = new Set<string>();
	if (!result.success) {
		for (const issue of result.error.issues) invalid.add(String(issue.path[0]));
	}
	if (input.NODE_ENV === "production") {
		for (const [name, schema] of Object.entries(envSchema.shape)) {
			if (schema.meta()?.productionRequired && input[name] === undefined)
				invalid.add(name);
		}
	}
	// Do not expose Zod errors: their messages can contain input values.
	if (invalid.size || !result.success) {
		throw new Error(
			`Invalid backend environment (missing or invalid): ${[...invalid].sort().join(", ")}`,
		);
	}
	for (const message of deprecated) warn(message);
	const { TAP_URL: _url, TAP_ADMIN_PASSWORD: _password, ...env } = result.data;
	return env;
}

export function environmentTable(): string {
	return [
		"| Variable | Requirement | Purpose |",
		"| --- | --- | --- |",
		...Object.entries(envSchema.shape).map(
			([name, schema]) =>
				`| \`${name}\` | ${schema.meta()?.productionRequired ? "Required in production" : schema.safeParse(undefined).success && schema.safeParse(undefined).data !== undefined ? "Defaulted" : "Optional"} | ${schema.description} |`,
		),
	].join("\n");
}
