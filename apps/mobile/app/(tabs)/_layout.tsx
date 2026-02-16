import { Tabs } from "expo-router";
import { Home, Search, User } from "lucide-react-native";
import { useTheme } from "@/contexts/theme";

export default function TabLayout() {
	const { colors } = useTheme();

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
				options={{
					title: "Profile",
					tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
					headerShown: false,
				}}
			/>
		</Tabs>
	);
}
