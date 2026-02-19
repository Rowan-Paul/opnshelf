import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import {
	applyThemeToDocument,
	DEFAULT_SEED_COLOR,
	generateMaterialTheme,
	type MaterialThemeColors,
} from "@/lib/material-theme";

interface ThemeContextType {
	seedColor: string;
	colors: MaterialThemeColors;
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
	const [colors] = useState<MaterialThemeColors>(() =>
		generateMaterialTheme(defaultSeedColor, true),
	);
	const isDark = true; // Always dark mode

	// Apply theme to document whenever colors change
	useEffect(() => {
		applyThemeToDocument(colors);
	}, [colors]);

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
