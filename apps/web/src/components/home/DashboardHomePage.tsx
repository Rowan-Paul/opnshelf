import {
	listsControllerGetUserListsOptions,
	moviesControllerUnmarkWatchedMutation,
	shelfControllerGetUserActivitySummaryOptions,
	shelfControllerGetUserShelfOptions,
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
	showsControllerGetUserUpNextOptions,
	type UserDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Search } from "lucide-react";
import { useMemo } from "react";
import { CreateListDialog } from "@/components/CreateListDialog";
import { AtAGlanceCard } from "@/components/home/AtAGlanceCard";
import { FriendsActivitySection } from "@/components/home/FriendsActivitySection";
import { UpNextSection } from "@/components/home/UpNextSection";
import { ListCard } from "@/components/ListCard";
import { MediaPosterCard } from "@/components/MediaPosterCard";
import { getSocialDisplayName } from "@/components/social/social-display";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import {
	invalidateUserShelfQueries,
	invalidateUserUpNextQueries,
} from "@/lib/invalidate-shelf";
import { getProfileRoute } from "@/lib/profile-routes";
import { createTitleSlug } from "@/lib/utils";

export function DashboardHomePage({ user }: { user: UserDto }) {
	const displayName = getSocialDisplayName(
		(user as unknown as { displayName?: string | null }).displayName,
		user.handle,
	);

	const { data: shelfData, isLoading } = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid: user.did },
			query: { page: 1, pageSize: 6 },
		}),
		enabled: !!user.did,
	});

	const { data: activitySummary } = useQuery({
		...shelfControllerGetUserActivitySummaryOptions({
			path: { userDid: user.did },
		}),
		enabled: !!user.did,
	});

	const { data: lists, isLoading: isListsLoading } = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: !!user.did,
	});

	const {
		data: upNext,
		isLoading: isUpNextLoading,
		isFetching: isUpNextFetching,
	} = useQuery({
		...showsControllerGetUserUpNextOptions({
			path: { userDid: user.did },
			query: { page: 1, pageSize: 4 },
		}),
		enabled: !!user.did,
	});

	const queryClient = useQueryClient();

	const unmarkMovieMutation = useMutation({
		mutationKey: ["dashboard", "movies", "unmarkWatched"],
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			invalidateUserShelfQueries(queryClient, user.did);
		},
	});

	const deleteEpisodeMutation = useMutation({
		mutationKey: ["dashboard", "episodes", "deleteWatchEntry"],
		...showsControllerDeleteEpisodeWatchHistoryEntryMutation(),
		onSuccess: () => {
			invalidateUserShelfQueries(queryClient, user.did);
			invalidateUserUpNextQueries(queryClient, user.did);
		},
	});

	const { recentWatched } = useMemo(() => {
		const items = shelfData?.items ?? [];

		const sorted = [...items].sort((a, b) => {
			const dateA = new Date(a.watchedDate ?? a.createdAt).getTime();
			const dateB = new Date(b.watchedDate ?? b.createdAt).getTime();
			return dateB - dateA;
		});

		return {
			recentWatched: sorted.slice(0, 8),
		};
	}, [shelfData]);

	const { recentLists } = useMemo(() => {
		const listItems = lists ?? [];
		const sortedLists = [...listItems].sort((a, b) => {
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		});

		return {
			recentLists: sortedLists.slice(0, 6),
		};
	}, [lists]);

	return (
		<div className="container mx-auto max-w-7xl px-4 py-8 md:py-10">
			<div
				className="mb-8 rounded-xl border p-5 md:p-6"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container-high)",
					borderColor: "var(--md-sys-color-outline-variant)",
				}}
			>
				<div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
					<div className="flex items-center gap-4">
						<div
							className="flex size-14 shrink-0 items-center justify-center rounded-full"
							style={{
								backgroundColor: "var(--md-sys-color-primary-container)",
							}}
						>
							<LayoutDashboard className="h-7 w-7 text-(--md-sys-color-primary)" />
						</div>
						<div className="min-w-0">
							<h1 className="md-display-small mb-1">Dashboard</h1>
							<p
								className="md-body-large"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								Welcome back, {displayName}
							</p>
						</div>
					</div>
					<M3Button
						variant="filled"
						asChild
						className="h-12 rounded-full px-6 md:min-w-40"
					>
						<Link to="/search" search={{ q: "", type: "all" }}>
							<Search className="size-5" />
							Search
						</Link>
					</M3Button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
				<div className="lg:col-span-3">
					<UpNextSection
						isFetching={isUpNextFetching}
						isLoading={isUpNextLoading}
						upNext={upNext?.items ?? []}
						userDid={user.did}
						userHandle={user.handle}
					/>
				</div>

				<div className="lg:col-span-2">
					<AtAGlanceCard activitySummary={activitySummary} />
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-8">
				<div className="lg:col-span-3">
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
						<h2 className="md-headline-small">Recent Watched</h2>
						<M3Button variant="text" className="rounded-full px-4" asChild>
							<Link {...getProfileRoute(user.handle, "shelf", { page: 1 })}>
								View shelf
							</Link>
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
							{recentWatched.map((item) => {
								const shelfItem = item as {
									id: string;
									type: string;
									movieId?: string;
									title?: string;
									showId?: string;
									showTitle?: string;
									seasonNumber?: number;
									episodeNumber?: number;
									posterPath?: string;
									releaseYear?: number;
								};
								const isMovie = shelfItem.type === "movie";
								const title = isMovie
									? (shelfItem.title ?? "Untitled")
									: (shelfItem.showTitle ?? "Untitled");

								return (
									<MediaPosterCard
										key={shelfItem.id}
										posterPath={shelfItem.posterPath}
										title={title}
										subtitle={
											isMovie ? shelfItem.releaseYear?.toString() : undefined
										}
										badge={
											!isMovie && shelfItem.seasonNumber != null
												? `S${shelfItem.seasonNumber} E${shelfItem.episodeNumber}`
												: undefined
										}
										to={
											isMovie
												? "/movies/$movieId/$title"
												: "/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber"
										}
										params={
											isMovie
												? {
														movieId: shelfItem.movieId ?? "",
														title: createTitleSlug(title),
													}
												: {
														showId: shelfItem.showId ?? "",
														title: createTitleSlug(title),
														seasonNumber: String(shelfItem.seasonNumber ?? 1),
														episodeNumber: String(shelfItem.episodeNumber ?? 1),
													}
										}
										user={user}
										listMedia={
											isMovie && shelfItem.movieId
												? {
														type: "movie",
														id: shelfItem.movieId,
														title,
													}
												: shelfItem.showId
													? {
															type: "show",
															id: shelfItem.showId,
															title,
														}
													: undefined
										}
										onRemove={() => {
											if (isMovie) {
												unmarkMovieMutation.mutate({
													path: {
														movieId: shelfItem.movieId ?? "",
													},
												});
											} else {
												deleteEpisodeMutation.mutate({
													path: {
														trackedEpisodeId: shelfItem.id,
													},
												});
											}
										}}
										isRemoving={
											isMovie
												? unmarkMovieMutation.isPending &&
													unmarkMovieMutation.variables?.path?.movieId ===
														shelfItem.movieId
												: deleteEpisodeMutation.isPending &&
													deleteEpisodeMutation.variables?.path
														?.trackedEpisodeId === shelfItem.id
										}
									/>
								);
							})}
						</div>
					) : (
						<M3Card
							variant="elevated"
							className="rounded-xl border"
							style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
						>
							<M3CardHeader>
								<M3CardTitle>No items watched yet</M3CardTitle>
								<M3CardDescription>
									Start adding watched items and your activity appears here.
								</M3CardDescription>
							</M3CardHeader>
							<M3CardContent>
								<M3Button
									variant="filled"
									className="rounded-full px-6"
									asChild
								>
									<Link to="/search" search={{ q: "", type: "all" }}>
										Search
									</Link>
								</M3Button>
							</M3CardContent>
						</M3Card>
					)}
				</div>

				<div className="lg:col-span-2">
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
						<h2 className="md-headline-small">Your Lists</h2>
						<M3Button variant="text" className="rounded-full px-4" asChild>
							<Link {...getProfileRoute(user.handle, "lists")}>All lists</Link>
						</M3Button>
					</div>
					<div className="mb-4">
						<CreateListDialog triggerClassName="ml-0 h-12 w-full justify-center rounded-full px-6 sm:w-auto" />
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
								<ListCard key={list.id} handle={user.handle} list={list} />
							))}
						</div>
					) : (
						<M3Card
							variant="elevated"
							className="rounded-xl border"
							style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
						>
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

			<div className="mt-8">
				<FriendsActivitySection userHandle={user.handle} />
			</div>
		</div>
	);
}
