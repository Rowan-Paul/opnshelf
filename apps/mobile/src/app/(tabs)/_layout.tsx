import { Image } from "expo-image";
import { Redirect, router, Tabs } from "expo-router";
import { Compass, Home, LogIn, Rss, User, Users } from "lucide-react-native";
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

	// Wait for auth to resolve. Guests are allowed in (search + media details
	// work logged out); authenticated users must finish verification/onboarding.
	if (isLoading) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<ActivityIndicator size="large" color={theme.colors.primary} />
			</View>
		);
	}
	if (user?.needsEmailVerification) {
		return <Redirect href="/verify-email" />;
	}
	if (user?.needsOnboarding) {
		return <Redirect href="/onboarding" />;
	}

	// Guests get a trimmed tab bar: Discover (landing) + a Sign in tab. The
	// account-based tabs are hidden rather than given placeholder screens.
	const guest = !isAuthenticated || !user;

	return (
		<TraktSyncBanner>
			<UpdateBanner>
				<ShakeToFeedback />
				<Tabs
					initialRouteName={guest ? "search" : "index"}
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
					<Tabs.Protected guard={!guest}>
						<Tabs.Screen
							name="index"
							options={{
								title: "Home",
								tabBarIcon: ({ color, size }) => (
									<Home color={color} size={size} />
								),
							}}
						/>
					</Tabs.Protected>
					<Tabs.Screen
						name="search"
						options={{
							title: "Discover",
							tabBarIcon: ({ color, size }) => (
								<Compass color={color} size={size} />
							),
						}}
					/>
					<Tabs.Protected guard={!guest}>
						<Tabs.Screen
							name="activity"
							options={{
								title: "Activity",
								tabBarIcon: ({ color, size }) => (
									<Rss color={color} size={size} />
								),
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
					</Tabs.Protected>
					<Tabs.Screen
						name="profile"
						// For guests this tab is a Sign in entry point: tapping it opens the
						// login screen instead of the (account-based) profile screen.
						listeners={
							guest
								? {
										tabPress: (e) => {
											e.preventDefault();
											router.push("/login");
										},
									}
								: undefined
						}
						options={
							guest
								? {
										title: "Sign in",
										tabBarIcon: ({ color, size }) => (
											<LogIn color={color} size={size} />
										),
									}
								: {
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
												{user?.avatar ? (
													<Image
														source={{ uri: user.avatar }}
														style={{ width: size, height: size }}
													/>
												) : (
													<User color="#94a3b8" size={Math.round(size * 0.6)} />
												)}
											</View>
										),
									}
						}
					/>
				</Tabs>
			</UpdateBanner>
		</TraktSyncBanner>
	);
}
