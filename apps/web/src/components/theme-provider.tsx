import {
	authControllerMeOptions,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
	const queryClient = useQueryClient();

	// Fetch user to check if logged in
	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	// Fetch user settings to get saved accent color
	const { data: settings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user?.did,
	});

	// Mutation to update accent color on the server
	const updateSettingsMutation = useMutation({
		...usersControllerUpdateMySettingsMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsOptions().queryKey,
			});
		},
	});

	// Apply saved accent color when settings are loaded
	useEffect(() => {
		if (settings?.accentColor) {
			setSeedColorState(settings.accentColor);
			setColors(generateMaterialTheme(settings.accentColor, true));
		}
	}, [settings?.accentColor]);

	// Apply theme to document whenever colors change
	useEffect(() => {
		applyThemeToDocument(colors);
	}, [colors]);

	// Update colors when seed color changes and save to API
	const setSeedColor = useCallback(
		(color: string) => {
			setSeedColorState(color);
			const newColors = generateMaterialTheme(color, true);
			setColors(newColors);

			// Save to API if user is logged in
			if (user?.did) {
				updateSettingsMutation.mutate({
					body: { accentColor: color },
				});
			}
		},
		[user?.did, updateSettingsMutation],
	);

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
