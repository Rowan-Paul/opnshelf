import { Link } from "expo-router";
import {
	Calendar,
	Check,
	Eye,
	RotateCcw,
	StarOff,
	X,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { StarRating } from "@/components/detail/StarRating";
import { WatchDatePickerModal } from "@/components/detail/WatchDatePickerModal";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useReview } from "@/lib/use-review";
import { useWatchActions } from "@/lib/use-watch-actions";
import { useWatchStatus } from "@/lib/use-watch-status";

interface MovieProps {
	mediaType: "movie";
	movieId: string;
}

interface ShowProps {
	mediaType: "show";
	showId: string;
}

type MediaTrackingActionsProps = MovieProps | ShowProps;

function formatWatchedDate(iso?: string) {
	if (!iso) return undefined;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return undefined;
	return d.toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/**
 * Tracking action bar for movie + show detail screens: mark watched (with an
 * optional custom date), unwatch, and rate/review. State (watched, latest date,
 * existing rating) is read via the watch-status + review hooks; all writes go
 * through the optimistic mutations in `useWatchActions` / `useReview`.
 */
export function MediaTrackingActions(props: MediaTrackingActionsProps) {
	const { isAuthenticated } = useAuth();
	const [datePickerVisible, setDatePickerVisible] = useState(false);

	const isMovie = props.mediaType === "movie";
	const mediaId = isMovie ? props.movieId : props.showId;

	const status = useWatchStatus(
		isMovie
			? { mediaType: "movie", movieId: props.movieId }
			: { mediaType: "show", showId: props.showId },
	);
	const actions = useWatchActions(
		isMovie
			? { mediaType: "movie", movieId: props.movieId }
			: { mediaType: "show", showId: props.showId },
	);
	const reviewState = useReview({ mediaType: props.mediaType, mediaId });

	const isWatched = isMovie ? !!status.isWatched : !!status.isTracking;
	const isMarkPending = isMovie
		? actions.isMarkMoviePending
		: actions.isMarkShowPending;
	const isUnmarkPending = isMovie
		? actions.isUnmarkMoviePending
		: actions.isUnmarkShowPending;

	const markWatched = (watchedAt?: string) => {
		if (isMovie) actions.markMovieWatched(watchedAt);
		else actions.markShowWatched(watchedAt);
	};
	const unmarkWatched = () => {
		if (isMovie) actions.unmarkMovieWatched();
		else actions.unmarkShowWatched();
	};

	const handleDateConfirm = (iso: string) => {
		setDatePickerVisible(false);
		markWatched(iso);
	};

	if (!isAuthenticated) {
		return (
			<View className="px-4">
				<Link href="/login" asChild>
					<Pressable className="items-center rounded-lg bg-primary py-3">
						<Text className="font-semibold text-primary-foreground">
							Sign in to track
						</Text>
					</Pressable>
				</Link>
			</View>
		);
	}

	const watchedDateLabel = formatWatchedDate(status.latestWatchedDate);

	return (
		<View className="gap-3 px-4">
			{isWatched ? (
				<View className="gap-2 rounded-xl border border-border bg-card p-3">
					<View className="flex-row items-center gap-2">
						<View className="rounded-full bg-primary/20 p-1.5">
							<Check color="#22c55e" size={16} />
						</View>
						<View className="flex-1">
							<Text className="font-semibold text-foreground text-sm">
								{isMovie ? "Watched" : "Tracking"}
							</Text>
							{isMovie && watchedDateLabel ? (
								<Text className="text-muted-foreground text-xs">
									{watchedDateLabel}
									{status.totalMovieWatches > 1
										? ` · ${status.totalMovieWatches} watches`
										: ""}
								</Text>
							) : null}
							{!isMovie && status.uniqueEpisodesWatched > 0 ? (
								<Text className="text-muted-foreground text-xs">
									{status.uniqueEpisodesWatched} episode
									{status.uniqueEpisodesWatched === 1 ? "" : "s"} watched
								</Text>
							) : null}
						</View>
						<Pressable
							hitSlop={8}
							onPress={unmarkWatched}
							disabled={isUnmarkPending}
							className="flex-row items-center gap-1 rounded-md border border-border px-2 py-1"
							style={{ opacity: isUnmarkPending ? 0.6 : 1 }}
						>
							<X color="#94a3b8" size={14} />
							<Text className="text-muted-foreground text-xs">Remove</Text>
						</Pressable>
					</View>
				</View>
			) : null}

			<View className="flex-row gap-2">
				<Pressable
					onPress={() => markWatched()}
					disabled={isMarkPending}
					className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-primary py-3"
					style={{ opacity: isMarkPending ? 0.7 : 1 }}
				>
					{isWatched ? (
						<RotateCcw color="#3f2e00" size={18} />
					) : (
						<Eye color="#3f2e00" size={18} />
					)}
					<Text className="font-semibold text-primary-foreground">
						{isWatched
							? isMovie
								? "Watch again"
								: "Mark watched"
							: isMovie
								? "Mark watched"
								: "Mark show watched"}
					</Text>
				</Pressable>
				<Pressable
					onPress={() => setDatePickerVisible(true)}
					className="items-center justify-center rounded-lg border border-border px-4"
				>
					<Calendar color="#94a3b8" size={20} />
				</Pressable>
			</View>

			<View className="flex-row items-center justify-between rounded-lg border border-border px-4 py-3">
				<View className="flex-row items-center gap-3">
					<StarRating
						rating={reviewState.rating}
						onChange={reviewState.setRating}
						size={24}
					/>
					<Text className="text-muted-foreground text-sm">
						{reviewState.rating > 0
							? `${(reviewState.rating / 2).toFixed(1)} / 5`
							: "Tap to rate"}
					</Text>
				</View>
				{reviewState.hasRating ? (
					<Pressable
						hitSlop={8}
						onPress={reviewState.clearRating}
						disabled={reviewState.isClearingRating}
						className="flex-row items-center gap-1"
						style={{ opacity: reviewState.isClearingRating ? 0.6 : 1 }}
					>
						<StarOff color="#94a3b8" size={16} />
						<Text className="text-muted-foreground text-xs">Clear</Text>
					</Pressable>
				) : null}
			</View>

			<WatchDatePickerModal
				visible={datePickerVisible}
				onDismiss={() => setDatePickerVisible(false)}
				onConfirm={handleDateConfirm}
				isLoading={isMarkPending}
			/>
		</View>
	);
}
