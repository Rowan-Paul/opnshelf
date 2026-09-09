// Learn more https://docs.expo.dev/guides/customizing-metro
const { getPostHogExpoConfig } = require("posthog-react-native/metro");
const { withUniwindConfig } = require("uniwind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// Expo's getDefaultConfig, plus a serializer step that stamps every bundle
// with a debug id. PostHog matches an exception's stack trace to the uploaded
// source map through that id (see RELEASE.md, "Source maps").
const config = getPostHogExpoConfig(projectRoot);

// Monorepo: watch the workspace root and resolve from both node_modules trees.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, "node_modules"),
	path.resolve(workspaceRoot, "node_modules"),
];

module.exports = withUniwindConfig(config, {
	cssEntryFile: "./src/global.css",
	dtsFile: "./src/uniwind-env.d.ts",
});
