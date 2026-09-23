import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/mini";

export const env = createEnv({
	server: {
		SERVER_URL: z.optional(z.url()),
		SSR_RATE_LIMIT_SECRET: z.optional(z.string().check(z.minLength(32))),
	},

	/**
	 * The prefix that client-side variables must have. This is enforced both at
	 * a type-level and at runtime.
	 */
	clientPrefix: "VITE_",

	client: {
		VITE_APP_TITLE: z.optional(z.string().check(z.minLength(1))),
		VITE_API_URL: z._default(z.optional(z.url()), "http://127.0.0.1:3001"),
		VITE_SITE_URL: z.optional(z.url()),
		// Cloudflare Turnstile site key for the signup captcha (public key).
		VITE_TURNSTILE_SITE_KEY: z.optional(z.string().check(z.minLength(1))),
		// Handle domain accounts are created on (the PDS host), e.g. "opnshelf.social".
		VITE_PDS_HANDLE_DOMAIN: z._default(
			z.optional(z.string().check(z.minLength(1))),
			"opnshelf.social",
		),
	},

	/**
	 * What object holds the environment variables at runtime. This is usually
	 * `process.env` or `import.meta.env`.
	 */
	runtimeEnv: {
		...import.meta.env,
		// Deployment secrets are runtime values, not Vite build-time constants.
		...(import.meta.env.SSR
			? {
					SERVER_URL: process.env.SERVER_URL,
					SSR_RATE_LIMIT_SECRET: process.env.SSR_RATE_LIMIT_SECRET,
				}
			: {}),
	},

	/**
	 * By default, this library will feed the environment variables directly to
	 * the Zod validator.
	 *
	 * This means that if you have an empty string for a value that is supposed
	 * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
	 * it as a type mismatch violation. Additionally, if you have an empty string
	 * for a value that is supposed to be a string with a default value (e.g.
	 * `DOMAIN=` in an ".env" file), the default value will never be applied.
	 *
	 * In order to solve these issues, we recommend that all new projects
	 * explicitly specify this option as true.
	 */
	emptyStringAsUndefined: true,
});
