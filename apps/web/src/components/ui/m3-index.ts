/**
 * Material Design 3 Component Library
 * OpnShelf - Cinematic Warmth Theme
 *
 * Components:
 * - M3Button: 5 variants (elevated, filled, filled-tonal, outlined, text)
 * - M3Card: 3 variants (elevated, filled, outlined) with composition
 * - M3Fab: Floating Action Button (primary, secondary, tertiary)
 * - M3Chip: Assist, filter, input, suggestion chips
 * - M3Navigation: Navigation rail and bottom app bar
 * - M3TextField: Outlined and filled input styles
 * - M3Snackbar: Toast notifications
 */

export type { M3ButtonProps } from "./m3-button";
// Buttons
export { M3Button, m3ButtonVariants } from "./m3-button";
export type { M3CardProps } from "./m3-card";
// Cards
export {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardFooter,
	M3CardHeader,
	M3CardTitle,
	m3CardVariants,
} from "./m3-card";
export type { M3ChipGroupProps, M3ChipProps } from "./m3-chip";
// Chips
export { M3Chip, M3ChipGroup, m3ChipVariants } from "./m3-chip";
export type { M3FabProps } from "./m3-fab";
// FAB
export { M3Fab, m3FabVariants } from "./m3-fab";
export type {
	M3BottomAppBarItemProps,
	M3BottomAppBarProps,
	M3NavigationRailItemProps,
	M3NavigationRailProps,
} from "./m3-navigation";
// Navigation
export {
	M3BottomAppBar,
	M3BottomAppBarItem,
	M3NavigationRail,
	M3NavigationRailItem,
	m3BottomAppBarItemVariants,
	m3BottomAppBarVariants,
	m3NavigationRailItemVariants,
	m3NavigationRailVariants,
} from "./m3-navigation";
export type { M3SnackbarProps, SnackbarItem } from "./m3-snackbar";
// Snackbar
export { M3Snackbar, M3SnackbarProvider, useSnackbar } from "./m3-snackbar";
export type { M3TextFieldProps } from "./m3-text-field";
// Text Field
export { M3TextField, m3TextFieldVariants } from "./m3-text-field";
