import {
	showsControllerGetUserUpNextQueryKey,
	showsControllerMarkWatchedMutation,
	type UpNextShowDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Calendar, Plus, Tv } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { posterUrl } from "@/lib/tmdb";
import { useProfileUpNext } from "@/lib/use-public-profile";

/**
 * Up Next tab: in-progress shows with their next episode + watch progress.
 * Owners get an "Add to shelf" button that marks the next episode watched.
 * Mirrors the web up-next page.
 */
export function UpNextTab({
	userDid,
	isOwner,
}: {
	userDid: string;
	isOwner: boolean;
}) {
	const { data, isLoading, isError } = useProfileUpNext(userDid);
	const queryClient = useQueryClient();
	const toast = useToast();

	const markWatched = useMutation({
		mutationKey: ["shows", "mark-watched"],
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserUpNextQueryKey({
					path: { userDid },
					query: { page: 1, pageSize: 20 },
				}),
			});
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Couldn't mark watched",
			),
	});

	const items = data?.items ?? [];

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<Text className="font-bold font-display text-2xl text-foreground">
				Up Next
			</Text>

			{isLoading ? (
				<View className="py-16">
					<ActivityIndicator color="#f3bc00" />
				</View>
			) : isError ? (
				<ErrorState message="Couldn't load Up Next." />
			) : items.length === 0 ? (
				<EmptyState
					icon={Tv}
					title="All caught up!"
					message="No upcoming episodes to watch."
				/>
			) : (
				<View className="gap-3">
					{items.map((item) => (
						<UpNextRow
							key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
							item={item}
							isOwner={isOwner}
							onMarkWatched={() =>
								markWatched.mutate({
									body: {
										showId: item.showId,
										seasonNumber: item.nextEpisode.seasonNumber,
										episodeNumber: item.nextEpisode.episodeNumber,
									},
								})
							}
							isPending={markWatched.isPending}
						/>
					))}
				</View>
			)}
		</View>
	);
}

function UpNextRow({
	item,
	isOwner,
	onMarkWatched,
	isPending,
}: {
	item: UpNextShowDto;
	isOwner: boolean;
	onMarkWatched: () => void;
	isPending: boolean;
}) {
	const next = item.nextEpisode;
	const progress =
		item.totalEpisodes > 0
			? Math.round((item.episodesWatched / item.totalEpisodes) * 100)
			: 0;

	return (
		<View className="flex-row gap-3 rounded-xl border border-border bg-card p-3">
			<Link
				href={{
					pathname: "/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
					params: {
						id: item.showId,
						seasonNumber: next.seasonNumber,
						episodeNumber: next.episodeNumber,
					},
				}}
				asChild
			>
				<Pressable className="shrink-0">
					<View className="h-32 w-22 overflow-hidden rounded-lg">
						<PosterImage
							url={posterUrl(item.show.posterPath, "w342")}
							className="h-32 w-22"
						/>
					</View>
				</Pressable>
			</Link>

			<View className="min-w-0 flex-1 justify-between">
				<View className="gap-1">
					<View className="flex-row items-start justify-between gap-2">
						<Text
							className="font-semibold text-foreground text-sm"
							numberOfLines={1}
						>
							{item.show.title}
						</Text>
						<View className="rounded-full bg-primary/20 px-2 py-0.5">
							<Text className="font-medium text-primary text-xs">
								S{next.seasonNumber}E{next.episodeNumber}
							</Text>
						</View>
					</View>
					<Text className="text-foreground text-sm" numberOfLines={1}>
						{next.name || `Episode ${next.episodeNumber}`}
					</Text>
					{next.airDate ? (
						<View className="flex-row items-center gap-1.5">
							<Calendar color="#94a3b8" size={13} />
							<Text className="text-muted-foreground text-xs">
								{new Date(next.airDate).toLocaleDateString()}
							</Text>
						</View>
					) : null}
				</View>

				<View className="mt-2 gap-2">
					<View className="flex-row items-center gap-2">
						<View className="h-1.5 flex-1 overflow-hidden rounded-full bg-background-subtle">
							<View
								className="h-full rounded-full bg-primary"
								style={{ width: `${progress}%` }}
							/>
						</View>
						<Text className="text-muted-foreground text-xs">
							{item.episodesWatched}/{item.totalEpisodes}
						</Text>
					</View>

					{isOwner ? (
						<Pressable
							onPress={onMarkWatched}
							disabled={isPending}
							className={cn(
								"flex-row items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2",
								isPending && "opacity-60",
							)}
						>
							<Plus color="#3f2e00" size={15} />
							<Text className="font-medium text-primary-foreground text-sm">
								Add to shelf
							</Text>
						</Pressable>
					) : null}
				</View>
			</View>
		</View>
	);
}
