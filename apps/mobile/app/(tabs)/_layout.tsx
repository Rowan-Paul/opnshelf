import { Tabs } from "expo-router";
import { Home, Search, Library } from "lucide-react-native";
import { colors } from "@/constants/theme";

export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: colors.primary,
				tabBarInactiveTintColor: colors.textMuted,
				tabBarStyle: {
					backgroundColor: colors.card,
					borderTopColor: colors.border,
				},
				headerStyle: {
					backgroundColor: colors.background,
				},
				headerTintColor: colors.text,
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Home",
					tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="search"
				options={{
					title: "Search",
					tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="shelf"
				options={{
					title: "Shelf",
					tabBarIcon: ({ color, size }) => <Library size={size} color={color} />,
				}}
			/>
		</Tabs>
	);
}
