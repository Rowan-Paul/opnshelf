import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	DEFAULT_SEED_COLOR,
	generateMaterialTheme,
	type MaterialThemeColors,
} from "@/constants/material-theme";
import { createExtendedColors, type ExtendedThemeColors } from "@/constants/extended-theme";
import {
	authControllerMeOptions,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
	usersControllerGetMySettingsQueryKey,
} from "@opnshelf/api";

interface ThemeContextType {
	seedColor: string;
	setSeedColor: (color: string) => void;
	colors: ExtendedThemeColors;
	isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const SEED_COLOR_KEY = "opnshelf-seed-color";

interface ThemeProviderProps {
	children: ReactNode;
	defaultSeedColor?: string;
}

export function ThemeProvider({
	children,
	defaultSeedColor = DEFAULT_SEED_COLOR,
}: ThemeProviderProps) {
	const [seedColor, setSeedColorState] = useState(defaultSeedColor);
	const [colors, setColors] = useState<ExtendedThemeColors>(() =>
		createExtendedColors(generateMaterialTheme(defaultSeedColor, true)),
	);
	const [isLoaded, setIsLoaded] = useState(false);
	const isDark = true;
	const queryClient = useQueryClient();

	// Fetch user to check if logged in
	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	// Fetch user settings from API
	const { data: settings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user?.did,
	});

	// Mutation to update accent color on the server
	const updateSettingsMutation = useMutation({
		...usersControllerUpdateMySettingsMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsQueryKey(),
			});
		},
	});

	// Load color from SecureStore first (for offline support), then from API
	useEffect(() => {
		const loadStoredColor = async () => {
			const stored = await SecureStore.getItemAsync(SEED_COLOR_KEY);
			if (stored) {
				setSeedColorState(stored);
				setColors(createExtendedColors(generateMaterialTheme(stored, true)));
			}
			setIsLoaded(true);
		};

		loadStoredColor();
	}, []);

	// When API settings are loaded, update the color (prefer server value)
	useEffect(() => {
		if (settings?.accentColor && isLoaded) {
			// Only update if different from current (to avoid overwriting user selection)
			if (settings.accentColor !== seedColor) {
				setSeedColorState(settings.accentColor);
				setColors(createExtendedColors(generateMaterialTheme(settings.accentColor, true)));
				// Also update SecureStore to match server
				SecureStore.setItemAsync(SEED_COLOR_KEY, settings.accentColor);
			}
		}
	}, [settings?.accentColor, isLoaded, seedColor]);

	const setSeedColor = useCallback(
		async (color: string) => {
			setSeedColorState(color);
			const newColors = createExtendedColors(generateMaterialTheme(color, true));
			setColors(newColors);

			// Always save to SecureStore for offline support
			await SecureStore.setItemAsync(SEED_COLOR_KEY, color);

			// If user is logged in, also save to API
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
