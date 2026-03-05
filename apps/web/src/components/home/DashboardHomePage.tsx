import {
	listsControllerGetUserListsOptions,
	shelfControllerGetUserShelfOptions,
	type UserDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarRange, Film, LayoutDashboard, ListChecks, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CreateListDialog } from "@/components/CreateListDialog";
import { ListCard } from "@/components/ListCard";
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

type DashboardRange = "week" | "month";

export function DashboardHomePage({ user }: { user: UserDto }) {
	const [range, setRange] = useState<DashboardRange>("week");
	const displayName =
		(user as unknown as { displayName?: string | null }).displayName ??
		user.handle;

	const { data: shelfData, isLoading } = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid: user.did },
			query: { limit: 6 },
		}),
		enabled: !!user.did,
	});

	const { data: lists, isLoading: isListsLoading } = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: !!user.did,
	});

	const { recentWatched, watchedInRangeCount, totalTracked } = useMemo(() => {
		const now = Date.now();
		const days = range === "week" ? 7 : 30;
		const cutoff = now - days * 24 * 60 * 60 * 1000;

		const items = shelfData?.items ?? [];

		const sorted = items.sort((a, b) => {
			const dateA = a.watchedDate ? new Date(a.watchedDate).getTime() : 0;
			const dateB = b.watchedDate ? new Date(b.watchedDate).getTime() : 0;
			return dateB - dateA;
		});

		const inRange = sorted.filter((item) => {
			const date = item.watchedDate ? new Date(item.watchedDate).getTime() : 0;
			return date >= cutoff;
		});

		return {
			recentWatched: sorted.slice(0, 8),
			watchedInRangeCount: inRange.length,
			totalTracked: shelfData?.total ?? 0,
		};
	}, [shelfData, range]);

	const { listCount, totalMoviesInLists, recentLists } = useMemo(() => {
		const listItems = lists ?? [];
		const sortedLists = [...listItems].sort((a, b) => {
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		});

		return {
			listCount: listItems.length,
			totalMoviesInLists: listItems.reduce(
				(acc, list) => acc + list.movieCount,
				0,
			),
			recentLists: sortedLists.slice(0, 6),
		};
	}, [lists]);

	return (
		<div className="container mx-auto px-4 py-10 max-w-6xl">
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
				<div>
					<h1 className="md-display-small mb-2 flex items-center gap-2">
						<LayoutDashboard className="h-7 w-7" />
						Dashboard
					</h1>
					<p
						className="md-body-large"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						Welcome back, {displayName}
					</p>
				</div>
				<M3Button variant="filled" asChild>
					<Link to="/search" search={{ q: "", type: "all" }}>
						<Search className="w-5 h-5 mr-2" />
						Search
					</Link>
				</M3Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
				<M3Card variant="elevated">
					<M3CardHeader className="pb-2">
						<M3CardTitle className="md-title-large flex items-center gap-2">
							<CalendarRange className="h-5 w-5" />
							Watched ({range === "week" ? "7 days" : "30 days"})
						</M3CardTitle>
					</M3CardHeader>
					<M3CardContent>
						<p className="md-display-small">{watchedInRangeCount}</p>
						<div className="flex gap-2 mt-3">
							<M3Button
								size="sm"
								variant={range === "week" ? "filled-tonal" : "text"}
								onClick={() => setRange("week")}
							>
								Week
							</M3Button>
							<M3Button
								size="sm"
								variant={range === "month" ? "filled-tonal" : "text"}
								onClick={() => setRange("month")}
							>
								Month
							</M3Button>
						</div>
					</M3CardContent>
				</M3Card>
				<M3Card variant="elevated">
					<M3CardHeader className="pb-2">
						<M3CardTitle className="md-title-large flex items-center gap-2">
							<Film className="h-5 w-5" />
							Total on Shelf
						</M3CardTitle>
					</M3CardHeader>
					<M3CardContent>
						<p className="md-display-small">{totalTracked}</p>
					</M3CardContent>
				</M3Card>
				<M3Card variant="elevated">
					<M3CardHeader className="pb-2">
						<M3CardTitle className="md-title-large flex items-center gap-2">
							<ListChecks className="h-5 w-5" />
							Your Lists
						</M3CardTitle>
					</M3CardHeader>
					<M3CardContent>
						<p className="md-display-small">{listCount}</p>
						<M3CardDescription>
							{totalMoviesInLists} total item
							{totalMoviesInLists !== 1 ? "s" : ""} in lists
						</M3CardDescription>
					</M3CardContent>
				</M3Card>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
				<div className="lg:col-span-3">
					<div className="flex items-center justify-between mb-4">
						<h2 className="md-headline-small">Recent Watched</h2>
						<M3Button variant="text" asChild>
							<Link to="/profile/shelf">View shelf</Link>
						</M3Button>
					</div>
					{isLoading ? (
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
							{[1, 2, 3, 4, 5, 6].map((i) => (
								<div
									key={i}
									className="aspect-2/3 rounded-lg animate-pulse"
									style={{
										backgroundColor:
											"var(--md-sys-color-surface-container-high)",
									}}
								/>
							))}
						</div>
					) : recentWatched.length > 0 ? (
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
							{recentWatched.map((item) =>
								item.type === "movie" ? (
									<ShelfMovieCard
										key={item.id}
										tracked={item as never}
										user={user}
									/>
								) : (
									<ShelfEpisodeCard
										key={item.id}
										tracked={item as never}
										user={user}
									/>
								),
							)}
						</div>
					) : (
						<M3Card variant="elevated">
							<M3CardHeader>
								<M3CardTitle>No items watched yet</M3CardTitle>
								<M3CardDescription>
									Start adding watched items and your activity appears here.
								</M3CardDescription>
							</M3CardHeader>
							<M3CardContent>
								<M3Button variant="filled" asChild>
									<Link to="/search" search={{ q: "", type: "all" }}>
										Search
									</Link>
								</M3Button>
							</M3CardContent>
						</M3Card>
					)}
				</div>

				<div className="lg:col-span-2">
					<div className="flex items-center justify-between mb-4">
						<h2 className="md-headline-small">Your Lists</h2>
						<M3Button variant="text" asChild>
							<Link to="/profile/lists">All lists</Link>
						</M3Button>
					</div>
					<div className="mb-4">
						<CreateListDialog />
					</div>
					{isListsLoading ? (
						<div className="grid grid-cols-1 gap-4">
							{[1, 2, 3].map((i) => (
								<div
									key={i}
									className="h-28 rounded-lg animate-pulse"
									style={{
										backgroundColor:
											"var(--md-sys-color-surface-container-high)",
									}}
								/>
							))}
						</div>
					) : recentLists.length > 0 ? (
						<div className="grid grid-cols-1 gap-4">
							{recentLists.map((list) => (
								<ListCard key={list.id} list={list} />
							))}
						</div>
					) : (
						<M3Card variant="elevated">
							<M3CardHeader>
								<M3CardTitle>No lists yet</M3CardTitle>
								<M3CardDescription>
									Create your first list to organize items.
								</M3CardDescription>
							</M3CardHeader>
						</M3Card>
					)}
				</div>
			</div>
		</div>
	);
}
