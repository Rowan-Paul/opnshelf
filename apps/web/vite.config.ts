import { createRequire } from "node:module";
import posthog from "@posthog/rollup-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { traceNodeModules } from "nf3";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { assertNoPublicSourceMaps } from "./src/lib/public-source-maps";

const config = defineConfig({
	// The commit this bundle was built from, for mutation failure reports. The
	// same value names the PostHog source map release below.
	define: {
		"import.meta.env.VITE_RELEASE_SHA": JSON.stringify(
			process.env.RAILWAY_GIT_COMMIT_SHA ?? "",
		),
	},
	ssr: { external: ["sharp"] },
	environments: { nitro: { resolve: { external: ["sharp"] } } },
	nitro: {
		// The Vite builder leaves Sharp external but does not trace its native files.
		hooks: {
			compiled: async (nitro) => {
				await traceNodeModules(
					[createRequire(import.meta.url).resolve("sharp")],
					{
						outDir: nitro.options.output.serverDir,
						fullTraceInclude: ["sharp"],
					},
				);
			},
		},
		// Serve prebuilt .br/.gz variants of the hashed assets instead of raw
		// bytes, so the origin never ships the entry bundle uncompressed.
		compressPublicAssets: { gzip: true, brotli: true },
		routeRules: {
			// Production counterpart to the local Vite proxy below. The wildcard
			// preserves PostHog's event, decide, and config request paths.
			"/ingest/**": {
				proxy: "https://eu.i.posthog.com/**",
			},
			// Apple requires the association file at an extensionless path, served
			// as application/json. Nitro's static handler types an extensionless
			// file as text/plain and a `headers` rule does not override it, so the
			// real file keeps its .json extension and this serves it internally.
			// A redirect would not work: iOS does not follow them for this file.
			"/.well-known/apple-app-site-association": {
				proxy: "/.well-known/apple-app-site-association.json",
			},
		},
	},
	server: {
		port: 3000,
		host: true,
		proxy: {
			"/ingest": {
				target: "https://eu.i.posthog.com",
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/ingest/, ""),
				secure: false,
			},
		},
	},
	plugins: [
		devtools(),
		tsconfigPaths({ projects: ["./tsconfig.json"] }),
		tailwindcss(),
		tanstackStart({
			prerender: {
				enabled: true,
				autoStaticPathsDiscovery: false,
				crawlLinks: false,
			},
			pages: [{ path: "/privacy" }, { path: "/tos" }],
		}),
		nitro(),
		viteReact(),
		process.env.POSTHOG_CLI_API_KEY && process.env.POSTHOG_CLI_PROJECT_ID
			? posthog({
					personalApiKey: process.env.POSTHOG_CLI_API_KEY,
					projectId: process.env.POSTHOG_CLI_PROJECT_ID,
					host: process.env.POSTHOG_CLI_HOST || "https://eu.posthog.com",
					sourcemaps: {
						releaseName: "opnshelf-web",
						releaseVersion: process.env.RAILWAY_GIT_COMMIT_SHA,
						releaseMode: "symbol-set",
						deleteAfterUpload: true,
					},
				})
			: false,
		{
			name: "reject-public-source-maps",
			apply: "build",
			applyToEnvironment: (environment) =>
				environment.config.consumer === "client",
			writeBundle: {
				order: "post",
				sequential: true,
				async handler({ dir }) {
					if (!dir) throw new Error("Client build output directory is missing");
					await assertNoPublicSourceMaps(dir);
					await assertNoPublicSourceMaps(new URL("./public", import.meta.url));
				},
			},
		},
	],
	test: {
		environment: "jsdom",
	},
});

export default config;
