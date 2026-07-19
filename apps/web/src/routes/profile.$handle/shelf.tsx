import {
	type ShelfResponseDto,
	shelfControllerGetUserShelfOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { CalendarDays, ChevronDown, Film, Search, Tv } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import ActionableMediaCard from "#/components/ActionableMediaCard";
import { Pagination } from "#/components/Pagination";
import { useAuth } from "#/lib/auth-context";
import { useWatchActions } from "#/lib/hooks/useWatchActions";

const searchSchema = z.object({
	page: z.coerce.number().min(1).optional().default(1),
	type: z.enum(["all", "movie", "episode"]).optional().default("all"),
});

export const Route = createFileRoute("/profile/$handle/shelf")({
	loader: async ({ context, params }) => {
		try {
			const profile = await context.queryClient.ensureQueryData(
				usersControllerGetPublicProfileOptions({
					path: { handle: params.handle },
				}),
			);
			return { profile };
		} catch {
			return { profile: null };
		}
	},
	head: ({ loaderData }) => {
		const name =
			loaderData?.profile?.displayName || loaderData?.profile?.handle || "User";
		return {
			meta: [{ title: `${name}'s Shelf | Opnshelf` }],
		};
	},
	component: ProfileShelfPage,
	validateSearch: searchSchema,
});

type FilterType = "all" | "movie" | "episode";

function sectionLabel(date: string): string {
	const watched = new Date(date);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const watchedDay = new Date(
		watched.getFullYear(),
		watched.getMonth(),
		watched.getDate(),
	);
	const days = Math.round((today.getTime() - watchedDay.getTime()) / 86_400_000);
	const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(
		watched,
	);
	if (days === 0) return `Today · ${weekday}`;
	if (days === 1) return `Yesterday · ${weekday}`;
	return new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(watched);
}

function ProfileShelfPage() {
	const { handle } = Route.useParams();
	const search = useSearch({ from: Route.id });
	const navigate = useNavigate();
	const { user } = useAuth();

	const page = search.page;
	const filter = search.type;

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});
	const userDid = profile?.did || "";
	const isOwner = user?.did === userDid;

	const [searchQuery, setSearchQuery] = useState("");
	const [showDividers, setShowDividers] = useState(true);
	const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
		new Set(),
	);

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

	const buildSearch = (newPage: number, newFilter: FilterType) => {
		const s: Record<string, unknown> = {};
		if (newFilter !== "all") s.type = newFilter;
		if (newPage > 1) s.page = newPage;
		return Object.keys(s).length > 0 ? s : undefined;
	};

	const navigateToPage = (newPage: number) => {
		navigate({
			to: "/profile/$handle/shelf",
			params: { handle },
			search: buildSearch(newPage, filter),
			replace: true,
		});
	};

	const handleFilterChange = (newFilter: FilterType) => {
		navigate({
			to: "/profile/$handle/shelf",
			params: { handle },
			search: buildSearch(1, newFilter),
			replace: true,
		});
	};

	const handleSearchChange = (value: string) => {
		setSearchQuery(value);
		if (page !== 1) {
			navigateToPage(1);
		}
	};
	const toggleSection = (label: string) => {
		setCollapsedSections((current) => {
			const next = new Set(current);
			if (next.has(label)) next.delete(label);
			else next.add(label);
			return next;
		});
	};

	const items = data?.items ?? [];
	const sections = items.reduce<Array<{ label: string; items: typeof items }>>(
		(groups, item) => {
			if (!item.watchedDate) return groups;
			const label = sectionLabel(item.watchedDate);
			const group = groups.at(-1);
			if (group?.label === label) group.items.push(item);
			else groups.push({ label, items: [item] });
			return groups;
		},
		[],
	);

	return (
		<div className="space-y-6">
			{/* Title & Controls */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-display-2">Shelf</h1>

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
			<div className="flex flex-wrap gap-2">
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
				<button
					type="button"
					onClick={() => setShowDividers((visible) => !visible)}
					aria-pressed={showDividers}
					className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors ${
						showDividers
							? "bg-(--background-elevated) text-(--foreground-muted) hover:bg-(--background-subtle) hover:text-(--foreground)"
							: "bg-(--background-subtle) text-(--foreground-muted)"
					}`}
				>
					<CalendarDays className="size-4" />
					Dates
				</button>
			</div>

			{/* Content */}
			{isLoading ? (
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
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
						{searchQuery ? "No results found." : "Shelf is empty."}
					</p>
				</div>
			) : showDividers ? (
				<div className="space-y-8">
					{sections.map((section) => {
						const collapsed = collapsedSections.has(section.label);
						return (
							<section key={section.label} className="space-y-3">
								<h2>
									<button
										type="button"
										onClick={() => toggleSection(section.label)}
										aria-expanded={!collapsed}
										className="flex w-full items-center justify-between border-(--border) border-b pb-2 text-left font-display font-semibold text-xl"
									>
										{section.label}
										<ChevronDown
											className={`size-5 text-(--foreground-muted) transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`}
										/>
									</button>
								</h2>
								{collapsed ? null : (
									<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
										{section.items.map((item) => (
											<ShelfWatchCard key={item.id} item={item} isOwner={isOwner} />
										))}
									</div>
								)}
							</section>
						);
					})}
				</div>
			) : (
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
					{items.map((item) => (
						<ShelfWatchCard key={item.id} item={item} isOwner={isOwner} />
					))}
				</div>
			)}

			{/* Pagination */}
			{data && data.totalPages > 1 && (
				<div className="flex justify-center pt-4">
					<Pagination
						page={data.page}
						totalPages={data.totalPages}
						onPageChange={navigateToPage}
					/>
				</div>
			)}
		</div>
	);
}

function ShelfWatchCard({
	item,
	isOwner,
}: {
	item: ShelfResponseDto["items"][number];
	isOwner: boolean;
}) {
	const isMovie = item.type === "movie";
	const actions = useWatchActions(
		isMovie
			? { mediaType: "movie", movieId: item.movieId }
			: { mediaType: "show", showId: item.showId },
	);
	const watchId = item.id.replace(/^(movie|episode):/, "");
	const remove = () => {
		if (isMovie) actions.deleteMovieWatchHistoryEntry(watchId);
		else actions.deleteEpisodeWatchHistoryEntry(watchId);
	};

	return (
		<ActionableMediaCard
			fill
			id={isMovie ? item.movieId : item.showId}
			title={isMovie ? item.title : item.showTitle}
			posterUrl={`https://image.tmdb.org/t/p/w500${item.posterPath}`}
			type={isMovie ? "movie" : "show"}
			seasonNumber={isMovie ? undefined : item.seasonNumber}
			episodeNumber={isMovie ? undefined : item.episodeNumber}
			episodeInfo={isMovie ? undefined : `S${item.seasonNumber}E${item.episodeNumber}${item.episodeTitle ? ` — ${item.episodeTitle}` : ""}`}
			watchedDate={item.watchedDate}
			interactive={false}
			isWatched
			onRemove={isOwner ? remove : undefined}
		/>
	);
}
