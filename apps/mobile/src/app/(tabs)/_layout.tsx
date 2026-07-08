import { Image } from "expo-image";
import { Redirect, Tabs } from "expo-router";
import { Compass, Home, Rss, User, Users } from "lucide-react-native";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { ShakeToFeedback } from "@/components/feedback/ShakeToFeedback";
import { TraktSyncBanner } from "@/components/trakt/TraktSyncBanner";
import { UpdateBanner } from "@/components/UpdateBanner";
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
	if (user.needsEmailVerification) {
		return <Redirect href="/verify-email" />;
	}
	if (user.needsOnboarding) {
		return <Redirect href="/onboarding" />;
	}

	return (
		<TraktSyncBanner>
			<ShakeToFeedback />
			<UpdateBanner />
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
						title: "Discover",
						tabBarIcon: ({ color, size }) => (
							<Compass color={color} size={size} />
						),
					}}
				/>
				<Tabs.Screen
					name="activity"
					options={{
						title: "Activity",
						tabBarIcon: ({ color, size }) => <Rss color={color} size={size} />,
					}}
				/>
				<Tabs.Screen
					name="connections"
					options={{
						title: "Connections",
						tabBarIcon: ({ color, size }) => (
							<Users color={color} size={size} />
						),
					}}
				/>
				<Tabs.Screen
					name="profile"
					options={{
						title: "Profile",
						// The viewer's own avatar (or the circular avatar placeholder
						// used elsewhere for missing pictures) disambiguates Profile from
						// the Connections (Users) tab.
						tabBarIcon: ({ size, focused }) => (
							<View
								className="items-center justify-center overflow-hidden rounded-full bg-background-subtle"
								style={{
									width: size,
									height: size,
									borderWidth: focused ? 2 : 0,
									borderColor: theme.colors.primary,
								}}
							>
								{user.avatar ? (
									<Image
										source={{ uri: user.avatar }}
										style={{ width: size, height: size }}
									/>
								) : (
									<User color="#94a3b8" size={Math.round(size * 0.6)} />
								)}
							</View>
						),
					}}
				/>
			</Tabs>
		</TraktSyncBanner>
	);
}
