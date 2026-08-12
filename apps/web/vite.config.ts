import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
	nitro: {
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
		tanstackStart(),
		nitro(),
		viteReact(),
	],
	test: {
		environment: "jsdom",
	},
});

export default config;
