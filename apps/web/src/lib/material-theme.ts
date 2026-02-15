import {
	argbFromHex,
	themeFromSourceColor,
} from "@material/material-color-utilities";

export interface MaterialThemeColors {
	// Primary palette
	primary: string;
	onPrimary: string;
	primaryContainer: string;
	onPrimaryContainer: string;

	// Secondary palette
	secondary: string;
	onSecondary: string;
	secondaryContainer: string;
	onSecondaryContainer: string;

	// Tertiary palette
	tertiary: string;
	onTertiary: string;
	tertiaryContainer: string;
	onTertiaryContainer: string;

	// Error palette
	error: string;
	onError: string;
	errorContainer: string;
	onErrorContainer: string;

	// Surface colors
	surface: string;
	onSurface: string;
	surfaceVariant: string;
	onSurfaceVariant: string;
	outline: string;
	outlineVariant: string;

	// Inverse colors
	inverseSurface: string;
	onInverseSurface: string;
	inversePrimary: string;

	// Scrim
	scrim: string;
	shadow: string;

	// Surface tints for elevation
	surfaceTint: string;
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

	return {
		// Primary
		primary: getColor(scheme.primary),
		onPrimary: getColor(scheme.onPrimary),
		primaryContainer: getColor(scheme.primaryContainer),
		onPrimaryContainer: getColor(scheme.onPrimaryContainer),

		// Secondary
		secondary: getColor(scheme.secondary),
		onSecondary: getColor(scheme.onSecondary),
		secondaryContainer: getColor(scheme.secondaryContainer),
		onSecondaryContainer: getColor(scheme.onSecondaryContainer),

		// Tertiary
		tertiary: getColor(scheme.tertiary),
		onTertiary: getColor(scheme.onTertiary),
		tertiaryContainer: getColor(scheme.tertiaryContainer),
		onTertiaryContainer: getColor(scheme.onTertiaryContainer),

		// Error
		error: getColor(scheme.error),
		onError: getColor(scheme.onError),
		errorContainer: getColor(scheme.errorContainer),
		onErrorContainer: getColor(scheme.onErrorContainer),

		// Surface
		surface: getColor(scheme.surface),
		onSurface: getColor(scheme.onSurface),
		surfaceVariant: getColor(scheme.surfaceVariant),
		onSurfaceVariant: getColor(scheme.onSurfaceVariant),
		outline: getColor(scheme.outline),
		outlineVariant: getColor(scheme.outlineVariant),

		// Inverse
		inverseSurface: getColor(scheme.inverseSurface),
		onInverseSurface: getColor(scheme.inverseOnSurface),
		inversePrimary: getColor(scheme.inversePrimary),

		// Scrim & Shadow
		scrim: getColor(scheme.scrim),
		shadow: getColor(scheme.shadow),

		// Surface tint (for elevation overlays)
		surfaceTint: getColor(scheme.primary),
	};
}

export function applyThemeToDocument(
	colors: MaterialThemeColors,
	element: HTMLElement = document.documentElement,
): void {
	const prefix = "--md-sys-color-";

	for (const [key, value] of Object.entries(colors)) {
		const cssKey = prefix + key.replace(/([A-Z])/g, "-$1").toLowerCase();
		element.style.setProperty(cssKey, value);
	}
}

// Default amber seed color for OpnShelf
export const DEFAULT_SEED_COLOR = "#F59E0B";

// Predefined warm color suggestions for the color picker
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
