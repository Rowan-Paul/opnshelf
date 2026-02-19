import {
	authControllerMeOptions,
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetSeasonDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkWatchedMutation,
	showsControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { M3Button } from "@/components/ui/m3-button";

export const Route = createFileRoute(
	"/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber",
)({
	component: ShowEpisodePage,
});

function ShowEpisodePage() {
	const { showId, seasonNumber, episodeNumber } = Route.useParams();
	const queryClient = useQueryClient();
	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	const resolvedUserDid = user?.did || "";

	const { data: episode } = useQuery({
		...showsControllerGetEpisodeDetailsOptions({
			path: { showId, seasonNumber, episodeNumber },
		}),
	});

	const { data: season } = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId, seasonNumber },
		}),
	});

	const { data: history } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: resolvedUserDid, showId },
		}),
		enabled: !!resolvedUserDid,
	});

	const watchedCountForEpisode =
		history?.filter(
			(h) =>
				h.seasonNumber === Number(seasonNumber) &&
				h.episodeNumber === Number(episodeNumber),
		).length || 0;

	const markMutation = useMutation({
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			toast.success("Episode marked watched");
		},
		onError: () => {
			toast.error("Failed to mark episode watched");
		},
	});

	const unmarkMutation = useMutation({
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid: resolvedUserDid },
				}),
			});
			toast.success("Episode unmarked");
		},
		onError: () => {
			toast.error("Failed to unmark episode");
		},
	});

	return (
		<div className="container mx-auto px-4 py-6 max-w-5xl">
			<h1 className="md-display-small mb-2">{season?.name}</h1>
			<h2 className="md-headline-small mb-4">
				Episode {episodeNumber}: {episode?.name}
			</h2>
			<p
				className="mb-6"
				style={{ color: "var(--md-sys-color-on-surface-variant)" }}
			>
				{episode?.overview || "No overview available."}
			</p>
			<div className="flex gap-3">
				<M3Button
					onClick={() =>
						markMutation.mutate({
							body: {
								showId,
								seasonNumber: Number(seasonNumber),
								episodeNumber: Number(episodeNumber),
							},
						})
					}
				>
					Mark Watched
				</M3Button>
				<M3Button
					variant="outlined"
					onClick={() =>
						unmarkMutation.mutate({
							path: { showId },
							query: {
								mode: "all",
								seasonNumber,
								episodeNumber,
							},
						})
					}
				>
					Unmark Episode
				</M3Button>
			</div>
			<div
				className="mt-6 text-sm"
				style={{ color: "var(--md-sys-color-on-surface-variant)" }}
			>
				Times watched: {watchedCountForEpisode}
			</div>
		</div>
	);
}
