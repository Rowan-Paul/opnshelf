// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Project root
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// Watch workspace packages for changes
config.watchFolders = [
  path.resolve(workspaceRoot, 'packages/api'),
  path.resolve(workspaceRoot, 'packages/types'),
];

// Metro resolves modules from these paths (in order)
// Only include app's node_modules to avoid pnpm resolution issues
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Enable symlinks support for pnpm
config.resolver.unstable_enableSymlinks = true;

// Disable hierarchical lookup to prevent resolving from wrong locations
config.resolver.disableHierarchicalLookup = true;

// Block pnpm virtual store directories from resolution
config.resolver.blockList = [
  /.*\/node_modules\/\.pnpm\/.*/,
];

// Configure path aliases
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  '@': path.resolve(__dirname, 'src'),
};

// Ensure workspace packages are resolvable
config.resolver.extraNodeModules = {
  '@opnshelf/api': path.resolve(workspaceRoot, 'packages/api'),
  '@opnshelf/types': path.resolve(workspaceRoot, 'packages/types'),
};

module.exports = withUniwindConfig(config, {
  // relative path to your global.css file (from previous step)
  cssEntryFile: './src/global.css',
  // (optional) path where we gonna auto-generate typings
  // defaults to project's root
  dtsFile: './src/uniwind-types.d.ts',
});
