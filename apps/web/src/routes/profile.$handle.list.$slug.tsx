import {
	listsControllerDeleteListMutation,
	listsControllerGetListOptions,
	listsControllerGetListQueryKey,
	listsControllerGetPublicUserListOptions,
	listsControllerGetUserListsQueryKey,
	listsControllerRemoveItemFromListMutation,
	type MediaInListDto,
	moviesControllerMarkWatchedMutation,
	showsControllerMarkSeasonWatchedMutation,
	showsControllerMarkShowWatchedMutation,
	showsControllerMarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, List, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MediaPosterCard } from "@/components/MediaPosterCard";
import { PosterGridSkeleton } from "@/components/MovieGrid";
import { PaginationControls } from "@/components/PaginationControls";
import { useTheme } from "@/components/theme-provider";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { useProfileRouteState } from "@/hooks/useProfileRouteState";
import {
	invalidateUserShelfQueries,
	invalidateUserUpNextQueries,
} from "@/lib/invalidate-shelf";
import { getVisiblePages, parsePageNumber } from "@/lib/pagination";
import { getProfileRoute } from "@/lib/profile-routes";
import { createTitleSlug, parseScopedShowMediaId } from "@/lib/utils";

const PAGE_SIZE = 24;

export const Route = createFileRoute("/profile/$handle/list/$slug")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: parsePageNumber(search.page),
	}),
	head: ({ params }) => ({
		meta: [{ title: `@${params.handle.replace(/^@/, "")} List | OpnShelf` }],
	}),
	component: ProfileListDetailPage,
});

function ProfileListDetailPage() {
	const { handle, slug } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const queryClient = useQueryClient();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const { profile, currentUser, isOwner, isLoading } =
		useProfileRouteState(handle);
	const { seedColor } = useTheme();

	const userDid = profile?.did ?? "";
	const profileListsRoute = getProfileRoute(profile?.handle ?? handle, "lists");

	const ownerListQuery = useQuery({
		...listsControllerGetListOptions({
			path: { slug },
			query: { page, pageSize: PAGE_SIZE },
		}),
		enabled: isOwner && !!currentUser?.did,
	});
	const publicListQuery = useQuery({
		...listsControllerGetPublicUserListOptions({
			path: { userDid, slug },
			query: { page, pageSize: PAGE_SIZE },
		}),
		enabled: !!userDid && !isOwner,
		retry: false,
	});

	const list = isOwner ? ownerListQuery.data : publicListQuery.data;
	const isListLoading = isOwner
		? ownerListQuery.isLoading
		: publicListQuery.isLoading;
	const isListFetching = isOwner
		? ownerListQuery.isFetching
		: publicListQuery.isFetching;
	const items = list?.items ?? [];
	const currentPage = list?.page ?? page;
	const totalPages = list?.totalPages ?? 0;
	const totalItems = list?.total ?? 0;
	const pageNumbers = useMemo(
		() => getVisiblePages(currentPage, totalPages),
		[currentPage, totalPages],
	);

	const handleWatchSuccess = () => {
		invalidateUserShelfQueries(queryClient, currentUser?.did);
		invalidateUserUpNextQueries(queryClient, currentUser?.did);
		toast.success("Added to your shelf");
	};

	const removeMutation = useMutation({
		mutationKey: ["profile-list", handle, slug, "removeItem"],
		...listsControllerRemoveItemFromListMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({ path: { slug } }),
			});
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			toast.success("Removed from list");
		},
		onError: () => {
			toast.error("Failed to remove. Please try again.");
		},
	});

	const markMovieWatchedMutation = useMutation({
		mutationKey: ["profile-list", handle, slug, "watch", "movie"],
		...moviesControllerMarkWatchedMutation(),
		onSuccess: handleWatchSuccess,
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	const markShowWatchedMutation = useMutation({
		mutationKey: ["profile-list", handle, slug, "watch", "show"],
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: handleWatchSuccess,
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	const markSeasonWatchedMutation = useMutation({
		mutationKey: ["profile-list", handle, slug, "watch", "season"],
		...showsControllerMarkSeasonWatchedMutation(),
		onSuccess: handleWatchSuccess,
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	const markEpisodeWatchedMutation = useMutation({
		mutationKey: ["profile-list", handle, slug, "watch", "episode"],
		...showsControllerMarkWatchedMutation(),
		onSuccess: handleWatchSuccess,
		onError: () => {
			toast.error("Failed to update. Please try again.");
		},
	});

	useEffect(() => {
		if (!list) {
			return;
		}

		if (list.page !== page) {
			navigate({
				search: { page: list.page },
				replace: true,
				resetScroll: false,
			});
		}
	}, [list, navigate, page]);

	const deleteMutation = useMutation({
		mutationKey: ["profile-list", handle, slug, "delete"],
		...listsControllerDeleteListMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			toast.success("List deleted");
			navigate(profileListsRoute);
		},
		onError: () => {
			toast.error("Failed to delete. Please try again.");
		},
	});

	if (isLoading) {
		return <PosterGridSkeleton />;
	}

	if (!profile) {
		return null;
	}

	if (isListLoading) {
		return <PosterGridSkeleton />;
	}

	if (!list) {
		return (
			<M3Card variant="elevated" className="mx-auto max-w-md text-center">
				<M3CardHeader>
					<List
						className="mx-auto mb-4 h-16 w-16"
						style={{ color: "var(--md-sys-color-outline)" }}
					/>
					<M3CardTitle className="md-headline-small">
						List not found
					</M3CardTitle>
					<M3CardDescription>
						This list doesn&apos;t exist or isn&apos;t available on this
						profile.
					</M3CardDescription>
				</M3CardHeader>
				<M3CardContent>
					<M3Button variant="filled" asChild>
						<Link {...profileListsRoute}>Back to lists</Link>
					</M3Button>
				</M3CardContent>
			</M3Card>
		);
	}

	const handleQuickWatch = (item: MediaInListDto) => {
		if (item.mediaType === "movie") {
			markMovieWatchedMutation.mutate({
				body: { movieId: item.mediaId },
			});
			return;
		}

		const scopedShow = parseScopedShowMediaId(item.mediaId);
		const showId = String(
			item.media.showId ?? scopedShow?.showId ?? item.mediaId,
		);

		if (
			typeof scopedShow?.seasonNumber === "number" &&
			typeof scopedShow?.episodeNumber === "number"
		) {
			markEpisodeWatchedMutation.mutate({
				body: {
					showId,
					seasonNumber: scopedShow.seasonNumber,
					episodeNumber: scopedShow.episodeNumber,
				},
			});
			return;
		}

		if (typeof scopedShow?.seasonNumber === "number") {
			markSeasonWatchedMutation.mutate({
				body: {
					showId,
					seasonNumber: scopedShow.seasonNumber,
				},
			});
			return;
		}

		markShowWatchedMutation.mutate({
			body: { showId },
		});
	};

	const isQuickWatchPending = (item: MediaInListDto) => {
		if (item.mediaType === "movie") {
			return (
				markMovieWatchedMutation.isPending &&
				markMovieWatchedMutation.variables?.body?.movieId === item.mediaId
			);
		}

		const scopedShow = parseScopedShowMediaId(item.mediaId);
		const showId = String(
			item.media.showId ?? scopedShow?.showId ?? item.mediaId,
		);

		if (
			typeof scopedShow?.seasonNumber === "number" &&
			typeof scopedShow?.episodeNumber === "number"
		) {
			return (
				markEpisodeWatchedMutation.isPending &&
				markEpisodeWatchedMutation.variables?.body?.showId === showId &&
				markEpisodeWatchedMutation.variables?.body?.seasonNumber ===
					scopedShow.seasonNumber &&
				markEpisodeWatchedMutation.variables?.body?.episodeNumber ===
					scopedShow.episodeNumber
			);
		}

		if (typeof scopedShow?.seasonNumber === "number") {
			return (
				markSeasonWatchedMutation.isPending &&
				markSeasonWatchedMutation.variables?.body?.showId === showId &&
				markSeasonWatchedMutation.variables?.body?.seasonNumber ===
					scopedShow.seasonNumber
			);
		}

		return (
			markShowWatchedMutation.isPending &&
			markShowWatchedMutation.variables?.body?.showId === showId
		);
	};

	return (
		<div>
			<div className="mb-6">
				<M3Button variant="text" size="sm" asChild className="mb-4">
					<Link {...profileListsRoute}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to lists
					</Link>
				</M3Button>
				<div className="flex items-start justify-between gap-4">
					<div>
						<div className="mb-2 flex items-center gap-3">
							<List className="h-6 w-6" style={{ color: seedColor }} />
							<h1 className="md-headline-medium">{list.name}</h1>
							{list.isDefault ? (
								<span
									className="rounded-full px-2 py-0.5 text-xs"
									style={{
										backgroundColor: seedColor,
										color: "var(--md-sys-color-on-primary)",
									}}
								>
									Default
								</span>
							) : null}
						</div>
						{list.description ? (
							<p style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
								{list.description}
							</p>
						) : null}
					</div>
					{isOwner && !list.isDefault ? (
						<M3Button
							variant="outlined"
							size="sm"
							onClick={() => setShowDeleteConfirm(true)}
							disabled={deleteMutation.isPending}
							className="border-(--md-sys-color-error) text-(--md-sys-color-error)"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							{deleteMutation.isPending ? "Deleting..." : "Delete"}
						</M3Button>
					) : null}
				</div>
			</div>

			{totalItems > 0 ? (
				<>
					<PaginationControls
						currentPage={currentPage}
						totalPages={totalPages}
						pageNumbers={pageNumbers}
						isFetching={isListFetching || removeMutation.isPending}
						onPageChange={(nextPage) => {
							navigate({ search: { page: nextPage }, resetScroll: false });
						}}
					/>
					<p
						className="mb-6 mt-6 md-body-large"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{totalItems} item{totalItems !== 1 ? "s" : ""}
					</p>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{items.map((item) => {
							const media = item.media as {
								title?: string;
								posterPath?: string | null;
								releaseYear?: number | null;
								showId?: string;
							};
							const mediaType: "movie" | "show" =
								item.mediaType === "show" ? "show" : "movie";
							const scopedShow =
								mediaType === "show"
									? parseScopedShowMediaId(item.mediaId)
									: null;
							const showIdForNav =
								media.showId ?? scopedShow?.showId ?? item.mediaId;
							const seasonNumber = scopedShow?.seasonNumber;
							const episodeNumber = scopedShow?.episodeNumber;
							const mediaTitle = media.title ?? "Untitled";
							const titleSlug = createTitleSlug(mediaTitle);
							const isMovie = mediaType === "movie";
							const listContext =
								typeof seasonNumber === "number" &&
								typeof episodeNumber === "number"
									? `S${seasonNumber} E${episodeNumber}`
									: typeof seasonNumber === "number"
										? `Season ${seasonNumber}`
										: null;

							let linkTo: string;
							let linkParams: Record<string, string>;
							if (isMovie) {
								linkTo = "/movies/$movieId/$title";
								linkParams = { movieId: item.mediaId, title: titleSlug };
							} else if (
								typeof seasonNumber === "number" &&
								typeof episodeNumber === "number"
							) {
								linkTo =
									"/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber";
								linkParams = {
									showId: showIdForNav,
									title: titleSlug,
									seasonNumber: String(seasonNumber),
									episodeNumber: String(episodeNumber),
								};
							} else if (typeof seasonNumber === "number") {
								linkTo = "/shows/$showId/$title/seasons/$seasonNumber";
								linkParams = {
									showId: showIdForNav,
									title: titleSlug,
									seasonNumber: String(seasonNumber),
								};
							} else {
								linkTo = "/shows/$showId/$title";
								linkParams = { showId: showIdForNav, title: titleSlug };
							}

							return (
								<MediaPosterCard
									key={item.id}
									posterPath={media.posterPath}
									title={mediaTitle}
									subtitle={
										[media.releaseYear?.toString(), listContext]
											.filter(Boolean)
											.join(" · ") || undefined
									}
									to={linkTo}
									params={linkParams}
									user={isOwner ? currentUser : undefined}
									readOnly={!isOwner}
									isOnShelf={false}
									onToggleShelf={
										isOwner ? () => handleQuickWatch(item) : undefined
									}
									isShelfPending={isOwner ? isQuickWatchPending(item) : false}
									onRemove={
										isOwner
											? () => {
													removeMutation.mutate({
														path: {
															slug,
															mediaType,
															mediaId: item.mediaId,
														},
													});
												}
											: undefined
									}
									isRemoving={
										isOwner &&
										removeMutation.isPending &&
										removeMutation.variables?.path?.mediaType ===
											item.mediaType &&
										removeMutation.variables?.path?.mediaId === item.mediaId
									}
									removeIcon="x"
								/>
							);
						})}
					</div>
					<div className="mt-6">
						<PaginationControls
							currentPage={currentPage}
							totalPages={totalPages}
							pageNumbers={pageNumbers}
							isFetching={isListFetching || removeMutation.isPending}
							onPageChange={(nextPage) => {
								navigate({ search: { page: nextPage }, resetScroll: false });
							}}
						/>
					</div>
				</>
			) : (
				<M3Card variant="elevated" className="mx-auto max-w-md text-center">
					<M3CardHeader>
						<List
							className="mx-auto mb-4 h-16 w-16"
							style={{ color: "var(--md-sys-color-outline)" }}
						/>
						<M3CardTitle className="md-headline-small">
							No items yet
						</M3CardTitle>
						<M3CardDescription>
							{isOwner
								? "Add movies or shows to this list from the search page"
								: "This list doesn&apos;t have any items yet."}
						</M3CardDescription>
					</M3CardHeader>
					{isOwner ? (
						<M3CardContent>
							<M3Button variant="filled" asChild>
								<Link to="/search" search={{ q: "", type: "all" }}>
									Search for media
								</Link>
							</M3Button>
						</M3CardContent>
					) : null}
				</M3Card>
			)}

			<ConfirmDialog
				open={showDeleteConfirm}
				onOpenChange={setShowDeleteConfirm}
				onConfirm={() => deleteMutation.mutate({ path: { slug } })}
				title="Delete List"
				description={`Are you sure you want to delete "${list.name}"? This action cannot be undone.`}
				confirmText="Delete"
				isLoading={deleteMutation.isPending}
			/>
		</div>
	);
}
