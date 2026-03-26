import { authControllerMeOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoadingState } from "@/components/AuthLoadingState";
import { DashboardHomePage } from "@/components/home/DashboardHomePage";
import { LandingHomePage } from "@/components/home/LandingHomePage";

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

function HomePage() {
	const { data: user, isLoading: isUserLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	if (isUserLoading) {
		return <AuthLoadingState className="max-w-6xl py-16" />;
	}

	if (!user) {
		return <LandingHomePage />;
	}

	return <DashboardHomePage user={user} />;
}
