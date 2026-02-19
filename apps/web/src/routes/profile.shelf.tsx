import {
	authControllerMeOptions,
	shelfControllerGetUserShelfOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Loader2 } from "lucide-react";
import { ShelfEpisodeCard } from "@/components/ShelfEpisodeCard";
import { ShelfMovieCard } from "@/components/ShelfMovieCard";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";

export const Route = createFileRoute("/profile/shelf")({
	head: () => ({
		meta: [{ title: "My Shelf | OpnShelf" }],
	}),
	component: ShelfPage,
});

function ShelfPage() {
	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const userDid = user?.did || "";

	const shelfQuery = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: { limit: 100 },
		}),
		enabled: !!userDid,
	});

	const items = shelfQuery.data?.items ?? [];
	const totalCount = shelfQuery.data?.total ?? 0;

	if (shelfQuery.isLoading) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="w-8 h-8 animate-spin" />
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<M3Card variant="elevated" className="text-center max-w-md mx-auto">
				<M3CardHeader>
					<BookOpen
						className="w-16 h-16 mx-auto mb-4"
						style={{ color: "var(--md-sys-color-outline)" }}
					/>
					<M3CardTitle className="md-headline-small">
						Your shelf is empty
					</M3CardTitle>
					<M3CardDescription>
						Start tracking movies and shows you&apos;ve watched
					</M3CardDescription>
				</M3CardHeader>
				<M3CardContent>
					<M3Button variant="filled" asChild>
						<Link to="/search" search={{ q: "", type: "all" }}>
							Search for movies or shows
						</Link>
					</M3Button>
				</M3CardContent>
			</M3Card>
		);
	}

	return (
		<div>
			<p
				className="mb-6 md-body-large"
				style={{ color: "var(--md-sys-color-on-surface-variant)" }}
			>
				{totalCount} item{totalCount !== 1 ? "s" : ""} watched
			</p>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
				{items.map((item) =>
					item.type === "movie" ? (
						<ShelfMovieCard key={item.id} tracked={item as never} user={user} />
					) : (
						<ShelfEpisodeCard
							key={item.id}
							tracked={item as never}
							user={user}
						/>
					),
				)}
			</div>
		</div>
	);
}
