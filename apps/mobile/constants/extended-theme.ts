import { MaterialThemeColors, generateMaterialTheme, DEFAULT_SEED_COLOR } from "./material-theme";

export interface ExtendedThemeColors extends MaterialThemeColors {
	warning: string;
	text: string;
	textMuted: string;
	textSecondary: string;
	border: string;
	borderLight: string;
	card: string;
	cardMuted: string;
	success: string;
}

export function createExtendedColors(colors: MaterialThemeColors): ExtendedThemeColors {
	return {
		...colors,
		warning: colors.tertiary,
		text: colors.onSurface,
		textMuted: colors.onSurfaceVariant,
		textSecondary: colors.onSurfaceVariant,
		border: colors.outline,
		borderLight: colors.outlineVariant,
		card: colors.surfaceContainer,
		cardMuted: colors.surfaceContainerHigh,
		success: colors.tertiary,
	};
}

export const defaultColors = createExtendedColors(generateMaterialTheme(DEFAULT_SEED_COLOR, true));
