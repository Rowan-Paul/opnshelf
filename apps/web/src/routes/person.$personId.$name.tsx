import {
	authControllerMeOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerGetUserMoviesQueryKey,
	moviesControllerMarkWatchedMutation,
	moviesControllerUnmarkWatchedMutation,
	type PersonFilmographyItemDto,
	peopleControllerGetPersonDetailsOptions,
	peopleControllerGetPersonFilmographyInfiniteOptions,
	showsControllerGetUserShowsOptions,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkShowWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	type TmdbPersonDetailDto,
} from "@opnshelf/api";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Calendar, MapPin, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { DatePickerModal } from "@/components/DatePickerModal";
import { DetailHero } from "@/components/detail";
import { MediaPosterCard } from "@/components/MediaPosterCard";
import { useTheme } from "@/components/theme-provider";
import { createTitleSlug, getTmdbProfileUrl } from "@/lib/utils";

export const Route = createFileRoute("/person/$personId/$name")({
	loader: async ({ params, context }) => {
		const { personId } = params;
		const { queryClient } = context;

		const data = await queryClient.fetchQuery({
			...peopleControllerGetPersonDetailsOptions({
				path: { personId },
			}),
		});

		return data as TmdbPersonDetailDto;
	},
	head: ({ loaderData }) => {
		const profileUrl = loaderData?.profile_path
			? `https://image.tmdb.org/t/p/w500${loaderData.profile_path}`
			: null;
		const title = loaderData
			? `${loaderData.name} | OpnShelf`
			: "Person | OpnShelf";
		const url = typeof window !== "undefined" ? window.location.href : "";

		return {
			meta: [
				{ title },
				{
					name: "description",
					content: loaderData?.biography?.slice(0, 160) || "",
				},
				{ property: "og:title", content: title },
				{
					property: "og:description",
					content: loaderData?.biography?.slice(0, 160) || "",
				},
				{ property: "og:type", content: "profile" },
				{ property: "og:url", content: url },
				...(profileUrl ? [{ property: "og:image", content: profileUrl }] : []),
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: title },
				{
					name: "twitter:description",
					content: loaderData?.biography?.slice(0, 160) || "",
				},
				...(profileUrl ? [{ name: "twitter:image", content: profileUrl }] : []),
			],
		};
	},
	component: PersonDetailPage,
});

function formatDate(dateString?: string): string | null {
	if (!dateString) return null;
	return new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function formatLifespan(birthday?: string, deathday?: string): string | null {
	if (!birthday) return null;

	const birthYear = new Date(birthday).getFullYear();

	if (deathday) {
		const deathYear = new Date(deathday).getFullYear();
		return `${birthYear} - ${deathYear}`;
	}

	return `${birthYear} - Present`;
}

function PersonDetailPage() {
	const { personId, name } = Route.useParams();
	const router = useRouter();
	const { seedColor } = useTheme();
	const queryClient = useQueryClient();

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	const userDid = user?.did || "";

	const { data: personData, isLoading: isPersonLoading } = useQuery({
		...peopleControllerGetPersonDetailsOptions({
			path: { personId },
		}),
	});

	const {
		data: filmographyData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		status,
	} = useInfiniteQuery({
		...peopleControllerGetPersonFilmographyInfiniteOptions({
			path: { personId },
		}),
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
	});

	// Fetch user's tracked movies and shows for watch status
	const { data: trackedMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});

	const { data: trackedShows } = useQuery({
		...showsControllerGetUserShowsOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});

	const person = personData as TmdbPersonDetailDto | undefined;

	const colors = {
		primary: seedColor,
		secondary: seedColor,
		accent: seedColor,
		muted: "var(--md-sys-color-surface-container)",
	};

	const profileUrl = getTmdbProfileUrl(person?.profile_path);

	const subtitle = useMemo(() => {
		const lifespan = formatLifespan(person?.birthday, person?.deathday);
		if (person?.known_for_department && lifespan) {
			return `${person.known_for_department} • ${lifespan}`;
		}
		if (person?.known_for_department) {
			return person.known_for_department;
		}
		if (lifespan) {
			return lifespan;
		}
		return null;
	}, [person?.birthday, person?.deathday, person?.known_for_department]);

	const metadataItems = useMemo(() => {
		const items = [];

		if (person?.birthday) {
			const birthLabel = person.deathday
				? `Born: ${formatDate(person.birthday)}`
				: `Birthday: ${formatDate(person.birthday)}`;
			items.push({
				icon: <Calendar className="w-4 h-4" />,
				label: birthLabel,
			});
		}

		if (person?.deathday) {
			items.push({
				icon: <Calendar className="w-4 h-4" />,
				label: `Died: ${formatDate(person.deathday)}`,
			});
		}

		if (person?.place_of_birth) {
			items.push({
				icon: <MapPin className="w-4 h-4" />,
				label: person.place_of_birth,
			});
		}

		if (person?.popularity) {
			items.push({
				icon: <Star className="w-4 h-4" />,
				label: `Popularity: ${person.popularity.toFixed(1)}`,
			});
		}

		return items;
	}, [person]);

	// Flatten all filmography items from infinite query pages
	const filmographyItems = useMemo(() => {
		return filmographyData?.pages.flatMap((page) => page.items) ?? [];
	}, [filmographyData]);

	const totalFilmographyCount = filmographyData?.pages[0]?.total ?? 0;

	// Create lookup sets for watched items
	const watchedMovieIds = useMemo(() => {
		if (!trackedMovies) return new Set<string>();
		return new Set(trackedMovies.map((m) => m.movieId));
	}, [trackedMovies]);

	const watchedShowIds = useMemo(() => {
		if (!trackedShows) return new Set<string>();
		return new Set(trackedShows.map((s) => s.showId));
	}, [trackedShows]);

	// Calculate watched count
	const watchedCount = useMemo(() => {
		return filmographyItems.filter((item) => {
			if (item.media_type === "movie") {
				return watchedMovieIds.has(String(item.id));
			}
			return watchedShowIds.has(String(item.id));
		}).length;
	}, [filmographyItems, watchedMovieIds, watchedShowIds]);

	// Mark watched mutations
	const markMovieMutation = useMutation({
		mutationKey: ["movies", "markWatched"],
		...moviesControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({ path: { userDid } }),
			});
		},
	});

	const unmarkMovieMutation = useMutation({
		mutationKey: ["movies", "unmarkWatched"],
		...moviesControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: moviesControllerGetUserMoviesQueryKey({ path: { userDid } }),
			});
		},
	});

	const markShowMutation = useMutation({
		mutationKey: ["shows", "markShowWatched"],
		...showsControllerMarkShowWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({ path: { userDid } }),
			});
		},
	});

	const unmarkShowMutation = useMutation({
		mutationKey: ["shows", "unmarkWatched"],
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({ path: { userDid } }),
			});
		},
	});

	// Modal states
	const [datePickerModal, setDatePickerModal] = useState<{
		mediaType: "movie" | "show";
		mediaId: string;
		title: string;
		isWatched: boolean;
	} | null>(null);

	const handleToggleWatched = (item: PersonFilmographyItemDto) => {
		if (!user) return;

		const isMovie = item.media_type === "movie";
		const mediaId = String(item.id);
		const isWatched = isMovie
			? watchedMovieIds.has(mediaId)
			: watchedShowIds.has(mediaId);

		if (isWatched) {
			// Unmark
			if (isMovie) {
				unmarkMovieMutation.mutate({
					path: { movieId: mediaId },
					query: { mode: "all" },
				});
			} else {
				unmarkShowMutation.mutate({
					path: { showId: mediaId },
					query: { mode: "all" },
				});
			}
		} else {
			// Open date picker for marking
			setDatePickerModal({
				mediaType: item.media_type,
				mediaId,
				title: item.title,
				isWatched: false,
			});
		}
	};

	const handleMarkWithDate = (date: Date) => {
		if (!datePickerModal || !user) return;

		const { mediaType, mediaId } = datePickerModal;

		if (mediaType === "movie") {
			markMovieMutation.mutate({
				body: {
					movieId: mediaId,
					watchedAt: date.toISOString(),
				},
			});
		} else {
			markShowMutation.mutate({
				body: {
					showId: mediaId,
					watchedAt: date.toISOString(),
				},
			});
		}

		setDatePickerModal(null);
	};

	return (
		<div
			className="min-h-screen m3-background m3-on-background"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<DetailHero
				title={person?.name || name.replace(/-/g, " ")}
				subtitle={subtitle ?? undefined}
				backdropUrl={null}
				posterUrl={profileUrl}
				colors={colors}
				isLoading={isPersonLoading}
				onBack={() => router.history.back()}
			/>

			<div className="container mx-auto px-4 py-6 max-w-7xl">
				<div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 min-w-0">
					<div className="space-y-4 min-w-0">
						{/* Sidebar content */}
						<div className="m3-surface-container rounded-xl p-4">
							<h3
								className="m3-title-medium mb-3"
								style={{ color: colors.primary }}
							>
								Personal Info
							</h3>
							<div className="space-y-2">
								{metadataItems.map((item) => (
									<div
										key={item.label}
										className="flex items-center gap-2 text-sm"
										style={{ color: "var(--md-sys-color-on-surface-variant)" }}
									>
										{item.icon}
										<span>{item.label}</span>
									</div>
								))}
							</div>
						</div>

						{/* Watched Stats Card */}
						{user && filmographyItems.length > 0 && (
							<div className="m3-surface-container rounded-xl p-4">
								<h3
									className="m3-title-medium mb-2"
									style={{ color: colors.primary }}
								>
									Your Progress
								</h3>
								<div
									className="text-sm"
									style={{ color: "var(--md-sys-color-on-surface-variant)" }}
								>
									<span
										className="font-semibold"
										style={{ color: colors.primary }}
									>
										{watchedCount}
									</span>{" "}
									of{" "}
									<span className="font-medium">{totalFilmographyCount}</span>{" "}
									titles watched
								</div>
								{totalFilmographyCount > 0 && (
									<div className="mt-3 h-2 rounded-full bg-(--md-sys-color-surface-container-high)">
										<div
											className="h-full rounded-full transition-all"
											style={{
												width: `${Math.min(100, (watchedCount / totalFilmographyCount) * 100)}%`,
												backgroundColor: colors.primary,
											}}
										/>
									</div>
								)}
							</div>
						)}
					</div>

					<div className="space-y-6 min-w-0">
						{/* Biography Section */}
						{person?.biography && (
							<section>
								<h2
									className="text-xl font-semibold mb-3"
									style={{ color: colors.primary }}
								>
									Biography
								</h2>
								<p className="text-(--md-sys-color-on-surface-variant) leading-relaxed whitespace-pre-line">
									{person.biography}
								</p>
							</section>
						)}

						{/* Filmography Section */}
						<section>
							<div className="flex items-center justify-between mb-4">
								<h2
									className="text-xl font-semibold"
									style={{ color: colors.primary }}
								>
									Filmography
									<span className="ml-2 text-sm font-normal text-(--md-sys-color-on-surface-variant)">
										({totalFilmographyCount > 0 ? totalFilmographyCount : "..."}{" "}
										titles)
									</span>
								</h2>
							</div>

							{/* Filmography grid - first page loads automatically */}
							<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
								{filmographyItems.map((item: PersonFilmographyItemDto) => {
									const isMovie = item.media_type === "movie";
									const id = String(item.id);
									const year = isMovie
										? item.release_date?.split("-")[0]
										: item.first_air_date?.split("-")[0];
									const isWatched = isMovie
										? watchedMovieIds.has(id)
										: watchedShowIds.has(id);
									const isShelfPending = isMovie
										? (markMovieMutation.isPending &&
												markMovieMutation.variables?.body?.movieId === id) ||
											(unmarkMovieMutation.isPending &&
												unmarkMovieMutation.variables?.path?.movieId === id)
										: (markShowMutation.isPending &&
												markShowMutation.variables?.body?.showId === id) ||
											(unmarkShowMutation.isPending &&
												unmarkShowMutation.variables?.path?.showId === id);

									return (
										<MediaPosterCard
											key={`${item.media_type}-${item.id}`}
											posterPath={item.poster_path}
											title={item.title}
											subtitle={year}
											to={
												isMovie
													? "/movies/$movieId/$title"
													: "/shows/$showId/$title"
											}
											params={
												isMovie
													? {
															movieId: id,
															title: createTitleSlug(item.title),
														}
													: {
															showId: id,
															title: createTitleSlug(item.title),
														}
											}
											user={user}
											isOnShelf={isWatched}
											isShelfPending={isShelfPending}
											onToggleShelf={() => handleToggleWatched(item)}
											listMedia={
												user
													? {
															type: isMovie ? "movie" : "show",
															id,
															title: item.title,
														}
													: undefined
											}
										/>
									);
								})}
							</div>

							{/* Show more button / loading state */}
							<div className="py-6">
								{isFetchingNextPage ? (
									<div className="flex items-center justify-center gap-2 text-(--md-sys-color-on-surface-variant)">
										<div
											className="animate-spin rounded-full h-5 w-5 border-b-2"
											style={{ borderColor: colors.primary }}
										/>
										<span className="text-sm">Loading...</span>
									</div>
								) : hasNextPage ? (
									<button
										type="button"
										onClick={() => fetchNextPage()}
										className="w-full py-3 px-4 rounded-lg bg-(--md-sys-color-surface-container) hover:bg-(--md-sys-color-surface-container-high) transition-colors text-sm font-medium"
										style={{ color: colors.primary }}
									>
										Show more
									</button>
								) : filmographyItems.length > 0 ? (
									<p className="text-center text-sm text-(--md-sys-color-on-surface-variant)">
										Showing all {filmographyItems.length} titles
									</p>
								) : status === "success" ? (
									<p className="text-center text-sm text-(--md-sys-color-on-surface-variant)">
										No filmography available
									</p>
								) : null}
							</div>
						</section>
					</div>
				</div>
			</div>

			{/* Date Picker Modal */}
			{datePickerModal && user && (
				<DatePickerModal
					open={!!datePickerModal}
					onClose={() => setDatePickerModal(null)}
					mode={datePickerModal.mediaType === "movie" ? "movie" : "show"}
					movieId={
						datePickerModal.mediaType === "movie"
							? datePickerModal.mediaId
							: undefined
					}
					showId={
						datePickerModal.mediaType === "show"
							? datePickerModal.mediaId
							: undefined
					}
					userDid={user.did}
					modalTitle={`Mark "${datePickerModal.title}" as watched`}
					onSelect={handleMarkWithDate}
				/>
			)}

			{isPersonLoading && (
				<div
					className="fixed inset-0 flex items-center justify-center z-50"
					style={{
						backgroundColor: "var(--md-sys-color-background)",
					}}
				>
					<div
						className="animate-spin rounded-full h-16 w-16 border-b-2"
						style={{ borderColor: colors.primary }}
					/>
				</div>
			)}
		</div>
	);
}
