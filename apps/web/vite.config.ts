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
