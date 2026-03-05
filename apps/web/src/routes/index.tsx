import { authControllerMeOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
		return (
			<div className="container mx-auto px-4 py-16 max-w-6xl">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-28 rounded-2xl animate-pulse"
							style={{
								backgroundColor: "var(--md-sys-color-surface-container-high)",
							}}
						/>
					))}
				</div>
			</div>
		);
	}

	if (!user) {
		return <LandingHomePage />;
	}

	return <DashboardHomePage user={user} />;
}
