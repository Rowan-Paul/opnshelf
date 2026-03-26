import { createFileRoute } from "@tanstack/react-router";
import { AuthLoadingState } from "@/components/AuthLoadingState";
import { DashboardHomePage } from "@/components/home/DashboardHomePage";
import { LandingHomePage } from "@/components/home/LandingHomePage";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{ title: "OpnShelf | Discover, Curate, and Own Your Watch History" },
			{
				name: "description",
				content:
					"Browse movies and shows, build custom lists, import your history, and keep your data portable with AT Protocol identity.",
			},
		],
	}),
	component: HomePage,
});

export function HomePage() {
	const { data: user, isLoading: isUserLoading } = useCurrentUser();

	if (isUserLoading) {
		return <AuthLoadingState className="max-w-6xl py-16" />;
	}

	if (!user) {
		return <LandingHomePage />;
	}

	return <DashboardHomePage user={user} />;
}
