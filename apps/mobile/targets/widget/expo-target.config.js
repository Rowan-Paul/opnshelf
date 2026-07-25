/**
 * WidgetKit extension target for the Home-Screen Widget (see CONTEXT.md and
 * ADR 0017). `@bacons/apple-targets` links this folder into the generated
 * Xcode project on prebuild, so `ios/` stays disposable.
 *
 * The app group is mirrored from `ios.entitlements` in app.config.ts — it is
 * the only channel between the app and the widget (handle, theme, API origin).
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
	type: "widget",
	name: "widget",
	displayName: "Watch activity",
	// containerBackground(for: .widget) is iOS 17+.
	deploymentTarget: "17.0",
	frameworks: ["SwiftUI", "WidgetKit"],
	entitlements: {
		"com.apple.security.application-groups":
			config.ios?.entitlements?.["com.apple.security.application-groups"],
	},
});
