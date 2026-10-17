import { Redirect } from "expo-router";
import HomeScreen from "@/components/home/HomeScreen";
import { useAuth } from "@/lib/auth-context";

export default function HomeRoute() {
	const { user, isAuthenticated } = useAuth();
	// The launch URL chooses the route. Keep guest landing here so explicit
	// accessible links are never redirected by the tabs layout.
	if (!isAuthenticated || !user) return <Redirect href="/search" />;
	return <HomeScreen />;
}
