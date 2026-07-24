import * as SecureStore from "expo-secure-store";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useColorScheme } from "react-native";
import { Uniwind } from "uniwind";
import { setWidgetTheme } from "../../modules/widget-bridge";

/** User-facing appearance preference. `system` follows the OS color scheme. */
export type ThemePreference = "system" | "light" | "dark";

/** Effective color scheme actually applied to the UI. */
export type ThemeScheme = "light" | "dark";

const STORAGE_KEY = "theme_preference";
const DEFAULT_PREFERENCE: ThemePreference = "system";

function isThemePreference(value: string | null): value is ThemePreference {
	return value === "system" || value === "light" || value === "dark";
}

type ThemeContextValue = {
	/** The stored preference (`system` | `light` | `dark`). */
	preference: ThemePreference;
	/** Update + persist the preference. */
	setPreference: (preference: ThemePreference) => void;
	/** The effective scheme after resolving `system` against the OS. */
	scheme: ThemeScheme;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Single source of truth for app appearance. Loads the persisted preference,
 * resolves the effective scheme (preference, or the OS scheme when `system`),
 * applies it to Uniwind, and exposes it for the navigation theme + StatusBar.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
	const osColorScheme = useColorScheme();
	const [preference, setPreferenceState] =
		useState<ThemePreference>(DEFAULT_PREFERENCE);

	// Hydrate the stored preference once on mount.
	useEffect(() => {
		let active = true;
		void SecureStore.getItemAsync(STORAGE_KEY).then((stored) => {
			if (active && isThemePreference(stored)) {
				setPreferenceState(stored);
			}
		});
		return () => {
			active = false;
		};
	}, []);

	const scheme: ThemeScheme = useMemo(() => {
		if (preference === "system") {
			return osColorScheme === "dark" ? "dark" : "light";
		}
		return preference;
	}, [preference, osColorScheme]);

	// Pass the raw preference to Uniwind: for "system" it clears the
	// Appearance override and follows the OS live. Setting a concrete theme
	// here instead would pin Appearance.setColorScheme, freezing
	// useColorScheme until the next app restart. The Home-Screen Widget gets
	// the same preference so it never clashes with the app's appearance.
	useEffect(() => {
		Uniwind.setTheme(preference);
		setWidgetTheme(preference);
	}, [preference]);

	const setPreference = useMemo(
		() => (next: ThemePreference) => {
			setPreferenceState(next);
			void SecureStore.setItemAsync(STORAGE_KEY, next);
		},
		[],
	);

	const value = useMemo<ThemeContextValue>(
		() => ({ preference, setPreference, scheme }),
		[preference, setPreference, scheme],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeContextValue {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
