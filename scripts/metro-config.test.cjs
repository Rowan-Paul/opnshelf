const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const filename = path.resolve(__dirname, "../apps/mobile/metro.config.js");

for (const customResolver of [true, false]) {
	test(`asset registry bypass preserves resolver chain (custom=${customResolver})`, () => {
		const base = (_, name) => ({ type: "sourceFile", filePath: `base:${name}` });
		const fallback = (_, name) => ({ type: "sourceFile", filePath: `fallback:${name}` });
		const config = { resolver: customResolver ? { resolveRequest: base } : {} };
		const sandbox = {
			__dirname: path.dirname(filename),
			module: { exports: {} },
			require(name) {
				if (name === "node:path") return path;
				if (name === "posthog-react-native/metro") {
					return { getPostHogExpoConfig: () => config };
				}
				if (name === "uniwind/metro") {
					return {
						withUniwindConfig(input) {
							const original = input.resolver.resolveRequest;
							input.resolver.resolveRequest = (context, name, platform) =>
								name === "react-native"
									? { type: "sourceFile", filePath: "uniwind/components" }
									: (original ?? context.resolveRequest)(context, name, platform);
							return input;
						},
					};
				}
				throw new Error(`Unexpected dependency: ${name}`);
			},
		};
		vm.runInNewContext(readFileSync(filename, "utf8"), sandbox, { filename });
		const resolve = sandbox.module.exports.resolver.resolveRequest;
		const context = {
			originModulePath: path.resolve("node_modules/expo-asset/src/Asset.ts"),
			resolveRequest: fallback,
		};
		const prefix = customResolver ? "base" : "fallback";
		for (const platform of ["android", "ios"]) {
			assert.equal(resolve(context, "react-native", platform).filePath, `${prefix}:react-native`);
		}
		assert.equal(resolve(context, "react-native", "web").filePath, "uniwind/components");
		assert.equal(
			resolve({
				...context,
				originModulePath: path.resolve("apps/mobile/src/components/Button.tsx"),
			}, "react-native", "android").filePath,
			"uniwind/components",
		);
		assert.equal(resolve(context, "expo-font", "android").filePath, `${prefix}:expo-font`);
	});
}
