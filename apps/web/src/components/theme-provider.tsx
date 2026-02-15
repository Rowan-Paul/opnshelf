import {
	createContext,
	type ReactNode,
	useCallback,
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
	setSeedColor: (color: string) => void;
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
	const [seedColor, setSeedColorState] = useState(defaultSeedColor);
	const [colors, setColors] = useState<MaterialThemeColors>(() =>
		generateMaterialTheme(defaultSeedColor, true),
	);
	const isDark = true; // Always dark mode

	// Apply theme to document whenever colors change
	useEffect(() => {
		applyThemeToDocument(colors);
	}, [colors]);

	// Update colors when seed color changes
	const setSeedColor = useCallback((color: string) => {
		setSeedColorState(color);
		const newColors = generateMaterialTheme(color, true);
		setColors(newColors);
	}, []);

	return (
		<ThemeContext.Provider value={{ seedColor, setSeedColor, colors, isDark }}>
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
