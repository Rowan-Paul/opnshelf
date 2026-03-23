import {
	BottomTabBar,
	type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { router, Tabs, usePathname } from "expo-router";
import { Home, Search, User } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { TraktImportStatusBanner } from "@/components/TraktImportStatusBanner";
import { useTheme } from "@/contexts/theme";

const BANNER_GAP = 12;

export default function TabLayout() {
	const { colors } = useTheme();
	const pathname = usePathname();

	const normalizedPath = pathname.replace(/^\/\(tabs\)/, "");
	const isOnNestedProfileRoute = normalizedPath.startsWith("/profile/");

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: colors.primary,
				tabBarInactiveTintColor: colors.onSurfaceVariant,
				tabBarStyle: {
					backgroundColor: colors.surfaceContainer,
					borderTopColor: colors.outline,
				},
				headerStyle: {
					backgroundColor: colors.background,
				},
				headerTintColor: colors.onBackground,
			}}
			tabBar={(props) => <TabBarWithBanner {...props} />}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Home",
					tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
					headerShown: false,
				}}
			/>
			<Tabs.Screen
				name="search"
				options={{
					title: "Search",
					tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
					headerShown: false,
				}}
			/>
			<Tabs.Screen
				name="profile"
				listeners={{
					tabPress: (event) => {
						if (isOnNestedProfileRoute) {
							event.preventDefault();
							router.navigate("/(tabs)/profile");
						}
					},
				}}
				options={{
					title: "Profile",
					tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
					headerShown: false,
				}}
			/>
		</Tabs>
	);
}

function TabBarWithBanner(props: BottomTabBarProps) {
	const [tabBarHeight, setTabBarHeight] = useState(0);

	return (
		<View pointerEvents="box-none" style={styles.tabBarContainer}>
			<TraktImportStatusBanner
				bottomOffset={tabBarHeight > 0 ? tabBarHeight + BANNER_GAP : undefined}
			/>
			<View
				style={styles.tabBarMeasure}
				onLayout={(event) => setTabBarHeight(event.nativeEvent.layout.height)}
			>
				<BottomTabBar {...props} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	tabBarContainer: {
		alignSelf: "stretch",
		position: "relative",
		width: "100%",
	},
	tabBarMeasure: {
		width: "100%",
	},
});
