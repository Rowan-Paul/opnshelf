import { Redirect, Tabs } from "expo-router";
import { Home, Search, User } from "lucide-react-native";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { darkNavTheme, lightNavTheme } from "@/theme";

export default function TabLayout() {
	const colorScheme = useColorScheme();
	const theme = colorScheme === "dark" ? darkNavTheme : lightNavTheme;
	const { user, isLoading, isAuthenticated } = useAuth();

	// Gate: wait for auth to resolve, then require an authenticated, onboarded
	// user before rendering the tab group.
	if (isLoading) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<ActivityIndicator size="large" color={theme.colors.primary} />
			</View>
		);
	}
	if (!isAuthenticated || !user) {
		return <Redirect href="/login" />;
	}
	if (user.needsOnboarding) {
		return <Redirect href="/onboarding" />;
	}

	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: theme.colors.primary,
				tabBarInactiveTintColor: theme.colors.text,
				tabBarStyle: {
					backgroundColor: theme.colors.card,
					borderTopColor: theme.colors.border,
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Home",
					tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
				}}
			/>
			<Tabs.Screen
				name="search"
				options={{
					title: "Search",
					tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: "Profile",
					tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
				}}
			/>
		</Tabs>
	);
}
