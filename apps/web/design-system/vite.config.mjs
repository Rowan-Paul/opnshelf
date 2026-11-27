import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../src");
const shim = (file) => path.resolve(here, "shims", file);

// One classic script for the design system page. That page loads React 18
// as a global, so React stays external and the JSX runtime is a shim over
// React.createElement. The router and analytics are replaced: the page has
// neither.
export default defineConfig({
	root: here,
	publicDir: false,
	plugins: [tailwindcss()],
	define: { "process.env.NODE_ENV": '"production"' },
	esbuild: { jsx: "automatic" },
	logLevel: "warn",
	resolve: {
		alias: [
			{ find: /^react\/jsx(-dev)?-runtime$/, replacement: shim("jsx-runtime.js") },
			{ find: "@tanstack/react-router", replacement: shim("router.js") },
			{ find: "#/integrations/posthog/provider", replacement: shim("posthog.js") },
			{ find: /^#\//, replacement: `${src}/` },
		],
	},
	build: {
		outDir: path.resolve(here, ".generated/out"),
		emptyOutDir: true,
		minify: true,
		cssCodeSplit: false,
		lib: {
			entry: path.resolve(here, ".generated/entry.js"),
			name: "Opnshelf",
			formats: ["iife"],
			fileName: () => "bundle.js",
			cssFileName: "bundle",
		},
		rollupOptions: {
			external: ["react", "react-dom", "react-dom/client"],
			output: {
				globals: { react: "React", "react-dom": "ReactDOM", "react-dom/client": "ReactDOM" },
			},
			onwarn(warning, warn) {
				// Radix and TanStack ship "use client" directives, which mean
				// nothing in a single browser bundle.
				if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
				warn(warning);
			},
		},
	},
});
