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

const baseResolveRequest = config.resolver.resolveRequest;
const uniwindConfig = withUniwindConfig(config, {
	cssEntryFile: "./src/global.css",
	dtsFile: "./src/uniwind-env.d.ts",
});
const uniwindResolveRequest = uniwindConfig.resolver.resolveRequest;
uniwindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
	// Expo Asset 58 needs RN's new AssetRegistry export, which Uniwind 1.7's
	// component facade does not forward. Asset imports need no style wrapping.
	if (
		(platform === "android" || platform === "ios") &&
		moduleName === "react-native" &&
		context.originModulePath.includes(`${path.sep}expo-asset${path.sep}`)
	) {
		return (baseResolveRequest ?? context.resolveRequest)(
			context,
			moduleName,
			platform,
		);
	}
	return uniwindResolveRequest(context, moduleName, platform);
};
module.exports = uniwindConfig;
