import {
	argbFromHex,
	themeFromSourceColor,
} from "@material/material-color-utilities";

export interface MaterialThemeColors {
	primary: string;
	onPrimary: string;
	primaryContainer: string;
	onPrimaryContainer: string;
	secondary: string;
	onSecondary: string;
	secondaryContainer: string;
	onSecondaryContainer: string;
	tertiary: string;
	onTertiary: string;
	tertiaryContainer: string;
	onTertiaryContainer: string;
	error: string;
	onError: string;
	errorContainer: string;
	onErrorContainer: string;
	surface: string;
	onSurface: string;
	surfaceVariant: string;
	onSurfaceVariant: string;
	outline: string;
	outlineVariant: string;
	inverseSurface: string;
	onInverseSurface: string;
	inversePrimary: string;
	scrim: string;
	shadow: string;
	surfaceTint: string;
	background: string;
	onBackground: string;
	surfaceContainerLowest: string;
	surfaceContainerLow: string;
	surfaceContainer: string;
	surfaceContainerHigh: string;
	surfaceContainerHighest: string;
}

function argbToHex(argb: number): string {
	const r = (argb >> 16) & 0xff;
	const g = (argb >> 8) & 0xff;
	const b = argb & 0xff;
	return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function generateMaterialTheme(
	seedColor: string,
	isDark = true,
): MaterialThemeColors {
	const argb = argbFromHex(seedColor);
	const theme = themeFromSourceColor(argb, []);
	const scheme = isDark ? theme.schemes.dark : theme.schemes.light;

	const getColor = (color: number) => argbToHex(color);
	
	const getSurfaceContainerColor = (
		prop: "surfaceContainerLowest" | "surfaceContainerLow" | "surfaceContainer" | "surfaceContainerHigh" | "surfaceContainerHighest",
	): string => {
		const schemeAny = scheme as unknown as Record<string, number | undefined>;
		const value = schemeAny[prop];
		if (typeof value === "number") {
			return getColor(value);
		}
		return getColor(scheme.surface);
	};

	return {
		primary: getColor(scheme.primary),
		onPrimary: getColor(scheme.onPrimary),
		primaryContainer: getColor(scheme.primaryContainer),
		onPrimaryContainer: getColor(scheme.onPrimaryContainer),
		secondary: getColor(scheme.secondary),
		onSecondary: getColor(scheme.onSecondary),
		secondaryContainer: getColor(scheme.secondaryContainer),
		onSecondaryContainer: getColor(scheme.onSecondaryContainer),
		tertiary: getColor(scheme.tertiary),
		onTertiary: getColor(scheme.onTertiary),
		tertiaryContainer: getColor(scheme.tertiaryContainer),
		onTertiaryContainer: getColor(scheme.onTertiaryContainer),
		error: getColor(scheme.error),
		onError: getColor(scheme.onError),
		errorContainer: getColor(scheme.errorContainer),
		onErrorContainer: getColor(scheme.onErrorContainer),
		surface: getColor(scheme.surface),
		onSurface: getColor(scheme.onSurface),
		surfaceVariant: getColor(scheme.surfaceVariant),
		onSurfaceVariant: getColor(scheme.onSurfaceVariant),
		outline: getColor(scheme.outline),
		outlineVariant: getColor(scheme.outlineVariant),
		inverseSurface: getColor(scheme.inverseSurface),
		onInverseSurface: getColor(scheme.inverseOnSurface),
		inversePrimary: getColor(scheme.inversePrimary),
		scrim: getColor(scheme.scrim),
		shadow: getColor(scheme.shadow),
		surfaceTint: getColor(scheme.primary),
		background: getColor(scheme.background),
		onBackground: getColor(scheme.onBackground),
		surfaceContainerLowest: getSurfaceContainerColor("surfaceContainerLowest"),
		surfaceContainerLow: getSurfaceContainerColor("surfaceContainerLow"),
		surfaceContainer: getSurfaceContainerColor("surfaceContainer"),
		surfaceContainerHigh: getSurfaceContainerColor("surfaceContainerHigh"),
		surfaceContainerHighest: getSurfaceContainerColor("surfaceContainerHighest"),
	};
}

export const DEFAULT_SEED_COLOR = "#F59E0B";

export const WARM_COLOR_PRESETS = [
	{ name: "Amber", hex: "#F59E0B" },
	{ name: "Orange", hex: "#F97316" },
	{ name: "Coral", hex: "#FF6B6B" },
	{ name: "Peach", hex: "#FB923C" },
	{ name: "Rose", hex: "#F43F5E" },
	{ name: "Purple", hex: "#9333EA" },
	{ name: "Blue", hex: "#3B82F6" },
	{ name: "Teal", hex: "#14B8A6" },
	{ name: "Green", hex: "#22C55E" },
	{ name: "Red", hex: "#EF4444" },
];

export const m3BorderRadius = {
	none: 0,
	extraSmall: 4,
	small: 8,
	medium: 12,
	large: 16,
	extraLarge: 28,
	full: 9999,
} as const;
