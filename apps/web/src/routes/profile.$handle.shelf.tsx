import {
	moviesControllerUnmarkWatchedMutation,
	shelfControllerGetUserShelfOptions,
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { MediaPosterCard } from "@/components/MediaPosterCard";
import { PaginationControls } from "@/components/PaginationControls";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { useProfileRouteState } from "@/hooks/useProfileRouteState";
import {
	invalidateUserShelfQueries,
	invalidateUserUpNextQueries,
} from "@/lib/invalidate-shelf";
import { getVisiblePages, parsePageNumber } from "@/lib/pagination";
import {
	createTitleSlug,
	getDayKeyInTimezone,
	getShelfDayLabel,
} from "@/lib/utils";

const PAGE_SIZE = 24;

export const Route = createFileRoute("/profile/$handle/shelf")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: parsePageNumber(search.page),
	}),
	head: ({ params }) => ({
		meta: [{ title: `@${params.handle.replace(/^@/, "")} Shelf | OpnShelf` }],
	}),
	component: ProfileShelfPage,
});

function ProfileShelfPage() {
	const { handle } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { profile, currentUser, isOwner } = useProfileRouteState(handle);
	const { data: viewerSettings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!currentUser?.did,
	});
	const timezone =
		viewerSettings?.timezone ||
		Intl.DateTimeFormat().resolvedOptions().timeZone ||
		"UTC";

	const userDid = profile?.did ?? "";
	const displayName = String(
		profile?.displayName || profile?.handle || "This user",
	);
	const shelfQuery = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: { page, pageSize: PAGE_SIZE },
		}),
		enabled: !!userDid,
	});

	const queryClient = useQueryClient();
	const { formatDate } = useFormattedDate();

	const unmarkMovieMutation = useMutation({
		mutationKey: ["shelf", "movies", "unmarkWatched"],
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			invalidateUserShelfQueries(queryClient, userDid);
		},
	});

	const deleteEpisodeMutation = useMutation({
		mutationKey: ["shelf", "episodes", "deleteWatchEntry"],
		...showsControllerDeleteEpisodeWatchHistoryEntryMutation(),
		onSuccess: () => {
			invalidateUserShelfQueries(queryClient, userDid);
			invalidateUserUpNextQueries(queryClient, userDid);
		},
	});

	const items = shelfQuery.data?.items ?? [];
	const currentPage = shelfQuery.data?.page ?? page;
	const totalPages = shelfQuery.data?.totalPages ?? 0;
	const pageNumbers = useMemo(
		() => getVisiblePages(currentPage, totalPages),
		[currentPage, totalPages],
	);

	const daySections = useMemo(() => {
		const sections: Array<{
			dayKey: string;
			label: string;
			items: typeof items;
		}> = [];
		const sectionByKey = new Map<
			string,
			{
				dayKey: string;
				label: string;
				items: typeof items;
			}
		>();

		for (const item of items) {
			const watchedAt = item.watchedDate ?? item.createdAt;
			const dayKey = getDayKeyInTimezone(watchedAt, timezone);
			const existingSection = sectionByKey.get(dayKey);

			if (existingSection) {
				existingSection.items.push(item);
				continue;
			}

			const nextSection = {
				dayKey,
				label: getShelfDayLabel(dayKey, timezone),
				items: [item],
			};

			sectionByKey.set(dayKey, nextSection);
			sections.push(nextSection);
		}

		return sections;
	}, [items, timezone]);

	useEffect(() => {
		if (!shelfQuery.data) {
			return;
		}

		if (shelfQuery.data.page !== page) {
			navigate({
				search: { page: shelfQuery.data.page },
				replace: true,
				resetScroll: false,
			});
		}
	}, [navigate, page, shelfQuery.data]);

	if (!profile) {
		return null;
	}

	if (shelfQuery.isLoading) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<M3Card variant="elevated" className="mx-auto max-w-md text-center">
				<M3CardHeader>
					<BookOpen
						className="mx-auto mb-4 h-16 w-16"
						style={{ color: "var(--md-sys-color-outline)" }}
					/>
					<M3CardTitle className="md-headline-small">
						{isOwner
							? "Your shelf is empty"
							: `${displayName}'s shelf is empty`}
					</M3CardTitle>
					<M3CardDescription>
						{isOwner
							? "Start tracking movies and shows you've watched"
							: "No watched movies or episodes have been added yet."}
					</M3CardDescription>
				</M3CardHeader>
				{isOwner ? (
					<M3CardContent>
						<M3Button variant="filled" asChild>
							<Link to="/search" search={{ q: "", type: "all" }}>
								Search for movies or shows
							</Link>
						</M3Button>
					</M3CardContent>
				) : null}
			</M3Card>
		);
	}

	return (
		<div className="space-y-6">
			<PaginationControls
				currentPage={currentPage}
				totalPages={totalPages}
				pageNumbers={pageNumbers}
				isFetching={shelfQuery.isFetching}
				onPageChange={(nextPage) => {
					navigate({ search: { page: nextPage } });
				}}
			/>

			<div className="space-y-6">
				{daySections.map((section) => (
					<section
						key={section.dayKey}
						className="rounded-xl border p-4 md:p-5"
						style={{
							backgroundColor: "var(--md-sys-color-surface-container-low)",
							borderColor: "var(--md-sys-color-outline-variant)",
						}}
					>
						<div
							className="mb-4 flex flex-col gap-1 rounded-xl border px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-3"
							style={{
								backgroundColor:
									"var(--md-sys-color-surface-container-highest)",
								borderColor: "var(--md-sys-color-outline-variant)",
							}}
						>
							<h2 className="md-title-large">{section.label}</h2>
							<p
								className="md-body-small"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								{section.items.length} item
								{section.items.length !== 1 ? "s" : ""}
							</p>
						</div>

						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{section.items.map((item) => {
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
									watchedDate?: string;
								};
								const isMovie = shelfItem.type === "movie";
								const title = isMovie
									? (shelfItem.title ?? "Untitled")
									: (shelfItem.showTitle ?? "Untitled");
								const watchedLabel = shelfItem.watchedDate
									? `Watched ${formatDate(shelfItem.watchedDate, { includeTime: false })}`
									: undefined;
								const subtitle = isMovie
									? [shelfItem.releaseYear?.toString(), watchedLabel]
											.filter(Boolean)
											.join(" · ")
									: watchedLabel;

								return (
									<MediaPosterCard
										key={shelfItem.id}
										posterPath={shelfItem.posterPath}
										title={title}
										subtitle={subtitle || undefined}
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
										user={isOwner ? (currentUser ?? undefined) : undefined}
										readOnly={!isOwner}
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
										onRemove={
											isOwner
												? () => {
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
													}
												: undefined
										}
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
					</section>
				))}
			</div>

			<PaginationControls
				currentPage={currentPage}
				totalPages={totalPages}
				pageNumbers={pageNumbers}
				isFetching={shelfQuery.isFetching}
				onPageChange={(nextPage) => {
					navigate({ search: { page: nextPage } });
				}}
			/>
		</div>
	);
}
