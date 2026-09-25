import type { UpNextShowDto } from "@opnshelf/api";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Plus, Tv } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { PosterProgress } from "@/components/media/poster-progress";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { showHref } from "@/lib/media-href";
import { backdropUrl } from "@/lib/tmdb";
import {
	findShowProgress,
	useShowProgressForShow,
} from "@/lib/use-show-progress";
import { useMarkUpNextEpisode } from "@/lib/use-up-next";

/** Episode tile shared by profile queues and dashboard previews.
 * Each card owns its pending action; other users' queues remain read-only. */
export function UpNextCard({
	item,
	isOwner = true,
}: {
	item: UpNextShowDto;
	isOwner?: boolean;
}) {
	const markEpisode = useMarkUpNextEpisode();
	const { show, nextEpisode: ep } = item;
	const viewerProgressQuery = useShowProgressForShow(show.showId, !isOwner);
	const viewerProgress = findShowProgress(
		viewerProgressQuery.data,
		show.showId,
	);
	const progressData = isOwner
		? {
				episodesWatched: item.episodesWatched,
				episodesTotal: item.totalEpisodes,
				percentage:
					item.totalEpisodes > 0
						? Math.round((item.episodesWatched / item.totalEpisodes) * 100)
						: 0,
			}
		: viewerProgress?.state !== "unavailable"
			? viewerProgress
			: undefined;
	const [failedImages, setFailedImages] = useState<string[]>([]);
	const imagePath = [ep.stillPath, show.backdropPath].find(
		(path) => path && !failedImages.includes(path),
	);
	const href = showHref(
		show.showId,
		show.title,
		ep.seasonNumber,
		ep.episodeNumber,
	);

	return (
		<View className="overflow-hidden rounded-xl border border-border bg-card">
			<Link href={href} asChild>
				<Pressable
					accessibilityRole="link"
					accessibilityLabel={`${show.title}, season ${ep.seasonNumber}, episode ${ep.episodeNumber}`}
				>
					<View style={{ aspectRatio: 16 / 9 }} className="bg-slate-800">
						{imagePath ? (
							<Image
								source={{ uri: backdropUrl(imagePath, "w780") }}
								style={{ position: "absolute", inset: 0 }}
								contentFit="cover"
								transition={200}
								onError={() =>
									setFailedImages((paths) => [...paths, imagePath])
								}
							/>
						) : (
							<View className="absolute inset-0 items-center justify-center">
								<Tv color="#94a3b8" size={40} />
							</View>
						)}
						<LinearGradient
							colors={["transparent", "rgba(0,0,0,0.9)"]}
							style={{ position: "absolute", inset: 0 }}
						/>
						<View className="absolute right-0 bottom-0 left-0 gap-1 p-4">
							<Text className="text-white/85 text-xs">
								S{ep.seasonNumber} · E{ep.episodeNumber}
							</Text>
							<Text
								className="font-semibold text-base text-white"
								numberOfLines={2}
							>
								{show.title}
							</Text>
						</View>
						<PosterProgress
							progress={progressData}
							label="Show progress"
							isLoading={!isOwner && viewerProgressQuery.isLoading}
						/>
					</View>
				</Pressable>
			</Link>
			<View className="gap-3 p-4">
				<Link href={href} asChild>
					<Pressable accessibilityRole="link">
						<Text
							className="font-medium text-foreground text-sm"
							numberOfLines={2}
						>
							{ep.name || `Episode ${ep.episodeNumber}`}
						</Text>
					</Pressable>
				</Link>
				{ep.overview ? (
					<Text
						className="text-muted-foreground text-sm leading-relaxed"
						numberOfLines={3}
					>
						{ep.overview}
					</Text>
				) : null}
				<View className="flex-row flex-wrap items-center justify-between gap-2">
					{!isOwner && viewerProgressQuery.isLoading ? (
						<View className="h-3 w-28 animate-pulse rounded bg-background-subtle" />
					) : progressData && progressData.episodesTotal > 0 ? (
						<Text
							className="text-muted-foreground text-xs"
							style={{ fontVariant: ["tabular-nums"] }}
						>
							{progressData.episodesWatched} of {progressData.episodesTotal}{" "}
							watched
						</Text>
					) : (
						<View />
					)}
					{isOwner ? (
						<Button
							label="Add to shelf"
							size="sm"
							loading={markEpisode.isPending}
							loadingLabel="Adding…"
							leading={<Plus color="#3f2e00" size={16} strokeWidth={3} />}
							onPress={() =>
								markEpisode.mutate({
									body: {
										showId: item.showId,
										seasonNumber: ep.seasonNumber,
										episodeNumber: ep.episodeNumber,
									},
								})
							}
						/>
					) : null}
				</View>
			</View>
		</View>
	);
}
