import { DashboardHome } from "@/components/home/DashboardHome";
import { LandingHome } from "@/components/home/LandingHome";
import { useAuth } from "@/contexts/auth";

export default function HomeScreen() {
	const { user, isAuthenticated } = useAuth();

	if (!isAuthenticated || !user) {
		return <LandingHome />;
	}

	return <DashboardHome user={user} />;
}
