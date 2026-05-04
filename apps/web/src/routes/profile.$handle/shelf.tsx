import {
	shelfControllerGetUserShelfOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Film, Search, Tv } from "lucide-react";
import { useState } from "react";
import ActionableMediaCard from "#/components/ActionableMediaCard";
import { Pagination } from "#/components/Pagination";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";

setupApiClient();

export const Route = createFileRoute("/profile/$handle/shelf")({
	component: ProfileShelfPage,
});

type FilterType = "all" | "movie" | "episode";

function ProfileShelfPage() {
	const { handle } = Route.useParams();
	const { user } = useAuth();

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});
	const userDid = profile?.did || "";
	const displayName = profile?.displayName || profile?.handle || handle;
	const isOwner = user?.did === userDid;

	const [filter, setFilter] = useState<FilterType>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [page, setPage] = useState(1);

	// Server-side pagination with filtering
	const { data, isLoading } = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: {
				page,
				pageSize: 24,
				...(filter !== "all" ? { type: filter } : {}),
				...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
			},
		}),
		enabled: !!userDid,
	});

	const handleFilterChange = (newFilter: FilterType) => {
		setFilter(newFilter);
		setPage(1);
	};

	const handleSearchChange = (value: string) => {
		setSearchQuery(value);
		setPage(1);
	};

	const items = data?.items ?? [];

	return (
		<div className="space-y-6">
			{/* Title & Controls */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-display-2">{displayName}&apos;s Shelf</h1>

				<div className="flex items-center gap-3">
					{/* Search */}
					<div className="relative">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--foreground-muted)" />
						<input
							type="text"
							placeholder="Search shelf..."
							className="input h-9 w-48 pl-9! text-sm"
							value={searchQuery}
							onChange={(e) => handleSearchChange(e.target.value)}
						/>
					</div>
				</div>
			</div>

			{/* Filter Tabs */}
			<div className="flex gap-2">
				{(
					[
						{ key: "all", label: "All", icon: undefined },
						{ key: "movie", label: "Movies", icon: Film },
						{ key: "episode", label: "TV Episodes", icon: Tv },
					] as const
				).map((f) => {
					const Icon = f.icon;
					return (
						<button
							key={f.key}
							type="button"
							onClick={() => handleFilterChange(f.key)}
							className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors ${
								filter === f.key
									? "bg-(--accent) text-[#3f2e00]"
									: "bg-(--background-elevated) text-(--foreground-muted) hover:bg-(--background-subtle) hover:text-(--foreground)"
							}`}
						>
							{Icon && <Icon className="h-4 w-4" />}
							{f.label}
						</button>
					);
				})}
			</div>

			{/* Content */}
			{isLoading ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<div
							key={i}
							className="aspect-[2/3] animate-pulse rounded-lg bg-(--background-subtle)"
						/>
					))}
				</div>
			) : items.length === 0 ? (
				<div className="card p-8 text-center">
					<p className="text-(--foreground-muted)">
						{searchQuery
							? "No results found."
							: `${displayName}'s shelf is empty.`}
					</p>
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
					{items.map((item) => {
						const isMovie = item.type === "movie";
						return (
							<ActionableMediaCard
								key={item.id}
								id={
									isMovie ? (item.movieId as string) : (item.showId as string)
								}
								title={
									isMovie ? (item.title as string) : (item.showTitle as string)
								}
								posterUrl={`https://image.tmdb.org/t/p/w500${item.posterPath}`}
								type={isMovie ? "movie" : "show"}
								seasonNumber={
									isMovie ? undefined : (item.seasonNumber as number)
								}
								episodeNumber={
									isMovie ? undefined : (item.episodeNumber as number)
								}
								episodeInfo={
									isMovie
										? undefined
										: `S${item.seasonNumber}E${item.episodeNumber}${item.episodeTitle ? ` — ${item.episodeTitle}` : ""}`
								}
								watchedDate={item.watchedDate}
								interactive={isOwner}
								isWatched={true}
							/>
						);
					})}
				</div>
			)}

			{/* Pagination */}
			{data && data.totalPages > 1 && (
				<div className="flex justify-center pt-4">
					<Pagination
						page={data.page}
						totalPages={data.totalPages}
						onPageChange={setPage}
					/>
				</div>
			)}
		</div>
	);
}
