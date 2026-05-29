import { DarkTheme, DefaultTheme } from "expo-router";

/**
 * Navigation theme objects derived from the ported design tokens
 * (apps/web/src/styles.css). Uniwind drives in-tree component colors via the
 * CSS variables in `src/global.css`; these mirror the same palette for the
 * navigator chrome (headers, tab bar, card backgrounds) which lives outside
 * the className styling layer.
 *
 * As of SDK 56 the React Navigation theming primitives are re-exported from
 * `expo-router` (direct `@react-navigation/*` deps are not supported).
 */
type NavTheme = typeof DefaultTheme;

export const lightNavTheme: NavTheme = {
	...DefaultTheme,
	colors: {
		...DefaultTheme.colors,
		primary: "#f3bc00",
		background: "#f8fafc",
		card: "#ffffff",
		text: "#0f172a",
		border: "#e2e8f0",
		notification: "#ef4444",
	},
};

export const darkNavTheme: NavTheme = {
	...DarkTheme,
	colors: {
		...DarkTheme.colors,
		primary: "#fbbf24",
		background: "#020617",
		card: "#0f172a",
		text: "#f8fafc",
		border: "#1e293b",
		notification: "#ef4444",
	},
};
