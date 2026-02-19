import {
	createContext,
	useContext,
	useState,
	type ReactNode,
} from "react";
import {
	DEFAULT_SEED_COLOR,
	generateMaterialTheme,
	type MaterialThemeColors,
} from "@/constants/material-theme";
import { createExtendedColors, type ExtendedThemeColors } from "@/constants/extended-theme";

interface ThemeContextType {
	seedColor: string;
	colors: ExtendedThemeColors;
	isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

interface ThemeProviderProps {
	children: ReactNode;
	defaultSeedColor?: string;
}

export function ThemeProvider({
	children,
	defaultSeedColor = DEFAULT_SEED_COLOR,
}: ThemeProviderProps) {
	const [seedColor] = useState(defaultSeedColor);
	const [colors] = useState<ExtendedThemeColors>(() =>
		createExtendedColors(generateMaterialTheme(defaultSeedColor, true)),
	);
	const isDark = true;

	return (
		<ThemeContext.Provider value={{ seedColor, colors, isDark }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
