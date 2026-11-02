/**
 * Forces OkHttp in the generated `android/app/build.gradle` to a version that
 * rejects the eight compromised eMudhra intermediate CA certificates
 * (October 2026).
 *
 * React Native's networking (`fetch`, which also carries PostHog events) runs
 * on the OkHttp that React Native itself depends on, 4.9.2 as of 0.88. Devices
 * without an up-to-date Play Services would still trust those certificates.
 * OkHttp 4.12.1 blocks them. Drop this plugin once React Native ships 4.12.1
 * or later on its own.
 *
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const OKHTTP_VERSION = "4.12.1";
const MARKER = "// with-okhttp-version";

const BLOCK = `
${MARKER}
configurations.all {
    resolutionStrategy {
        force "com.squareup.okhttp3:okhttp:${OKHTTP_VERSION}"
        force "com.squareup.okhttp3:okhttp-urlconnection:${OKHTTP_VERSION}"
    }
}
`;

module.exports = (config) =>
	withAppBuildGradle(config, (config) => {
		if (!config.modResults.contents.includes(MARKER)) {
			config.modResults.contents += BLOCK;
		}
		return config;
	});
