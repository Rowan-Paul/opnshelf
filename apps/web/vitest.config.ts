import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Dedicated test config. The app's vite.config.ts wires the SSR pipeline
// (tanstack-start + nitro), which under Vitest pulls in a second, CJS copy of
// React and leaves the hook dispatcher null ("Cannot read properties of null
// (reading 'useState')"). Component unit tests only need the React plugin,
// path aliases, and jsdom — so keep them off the SSR build entirely.
export default defineConfig({
	plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] }), viteReact()],
	resolve: {
		dedupe: ["react", "react-dom"],
	},
	test: {
		environment: "jsdom",
		globals: true,
	},
});
