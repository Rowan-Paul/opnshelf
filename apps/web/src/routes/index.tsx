import { authControllerMeOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoadingState } from "@/components/AuthLoadingState";
import { DashboardHomePage } from "@/components/home/DashboardHomePage";
import { LandingHomePage } from "@/components/home/LandingHomePage";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{ title: "Track Movies and Shows | OpnShelf" },
			{
				name: "description",
				content:
					"Track movies and shows at movie, season, and episode level with watch history, lists, and AT Protocol account portability.",
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
