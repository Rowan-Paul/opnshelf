import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		// NestJS DI reads constructor param types from emitted decorator
		// metadata. esbuild (Vitest's default) can't emit it; swc can.
		swc.vite({
			jsc: {
				target: "es2022",
				keepClassNames: true,
				transform: { legacyDecorator: true, decoratorMetadata: true },
			},
		}),
		// ponytail: ports ts-jest's moduleNameMapper "^(.*)\.js$" -> "$1".
		// Generated lexicon/prisma code uses explicit .js specifiers that Vite
		// won't otherwise resolve to their .ts sources.
		{
			name: "resolve-ts-js-ext",
			enforce: "pre",
			async resolveId(source, importer) {
				if (
					importer &&
					source.endsWith(".js") &&
					(source.startsWith("./") || source.startsWith("../"))
				) {
					const r = await this.resolve(source.slice(0, -3), importer, {
						skipSelf: true,
					});
					if (r) return r;
				}
				return null;
			},
		},
	],
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.spec.ts"],
	},
});
