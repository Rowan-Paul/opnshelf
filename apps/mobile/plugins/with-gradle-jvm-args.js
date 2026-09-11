/**
 * Raises the Gradle daemon's JVM limits in the generated
 * `android/gradle.properties`.
 *
 * Expo's template pins `org.gradle.jvmargs` at 2 GB heap and a 512 MB
 * Metaspace. With R8 enabled (see `expo-build-properties` in app.config.ts)
 * the `minifyReleaseWithR8` task blows through that Metaspace cap and the
 * daemon dies with `OutOfMemoryError: Metaspace` instead of failing the task,
 * so the build hangs. The cap is a class-count limit, not a machine-size one,
 * so EAS hits it exactly like a laptop does. `expo-build-properties` has no
 * option for this property, hence the local plugin.
 *
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const { withGradleProperties } = require("expo/config-plugins");

const JVM_ARGS = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";

module.exports = (config) =>
	withGradleProperties(config, (config) => {
		const jvmArgs = config.modResults.find(
			(item) => item.type === "property" && item.key === "org.gradle.jvmargs",
		);
		if (jvmArgs && jvmArgs.type === "property") {
			jvmArgs.value = JVM_ARGS;
		} else {
			config.modResults.push({
				type: "property",
				key: "org.gradle.jvmargs",
				value: JVM_ARGS,
			});
		}
		return config;
	});
