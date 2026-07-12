import { reviewsControllerGetCanonicalReviewOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { type Href, Link, Stack, useLocalSearchParams } from "expo-router";
import { ArrowRight, CalendarDays, User } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { SpoilerShield } from "@/components/reviews/SpoilerShield";
import { Markdown } from "@/components/ui/Markdown";
import { ReviewsSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { mediaHref } from "@/lib/media-href";
import { posterUrl } from "@/lib/tmdb";

/**
 * The full review, on its own page — where "Read more" in any review list lands.
 * Resolved by {handle}/{rkey} via the same canonical endpoint the web review
 * page uses, and rendered unclamped.
 */
export default function ReviewDetailScreen() {
	const { handle, rkey } = useLocalSearchParams<{
		handle: string;
		rkey: string;
	}>();

	const {
		data: review,
		isLoading,
		isError,
	} = useQuery({
		...reviewsControllerGetCanonicalReviewOptions({ path: { handle, rkey } }),
		enabled: Boolean(handle && rkey),
	});

	const poster = review ? posterUrl(review.posterPath) : undefined;
	const reviewedMediaHref = review
		? (mediaHref({
				mediaType: review.mediaType,
				mediaId: review.mediaId,
				seasonNumber: review.seasonNumber,
				episodeNumber: review.episodeNumber,
			}) as Href)
		: undefined;
	const mediaKind = review
		? review.mediaType === "episode"
			? `Episode · S${review.seasonNumber ?? 0}E${review.episodeNumber ?? 0}`
			: review.mediaType === "season"
				? `Season ${review.seasonNumber ?? 0}`
				: review.mediaType === "movie"
					? "Film"
					: "Series"
		: "";

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: review?.title ?? "Review" }}
			/>
			{isLoading ? (
				<View className="gap-4 p-4 pb-12">
					<ReviewsSkeleton rows={1} />
					{/* Review body lines. */}
					<View className="gap-2">
						<View className="h-3 w-full rounded bg-background-subtle" />
						<View className="h-3 w-full rounded bg-background-subtle" />
						<View className="h-3 w-full rounded bg-background-subtle" />
						<View className="h-3 w-2/3 rounded bg-background-subtle" />
					</View>
				</View>
			) : isError || !review ? (
				<ErrorState message="Couldn't load this review." />
			) : (
				<ScrollView
					className="flex-1"
					contentInsetAdjustmentBehavior="automatic"
					contentContainerClassName="gap-6 p-4 pb-12"
				>
					{reviewedMediaHref ? (
						<Link href={reviewedMediaHref} asChild>
							<Pressable
								className="flex-row gap-4 rounded-2xl border border-border bg-background-subtle p-4 active:opacity-80"
								style={{ borderCurve: "continuous" }}
							>
								{poster ? (
									<Image
										source={{ uri: poster }}
										style={{ width: 88, height: 132, borderRadius: 12 }}
										contentFit="cover"
									/>
								) : (
									<View className="h-[132px] w-[88px] rounded-xl bg-background" />
								)}
								<View className="flex-1 justify-center gap-2">
									<Text className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
										Review of
									</Text>
									<Text
										selectable
										className="font-bold font-display text-foreground text-xl"
										numberOfLines={3}
									>
										{review.mediaTitle ?? "This title"}
									</Text>
									<Text className="text-muted-foreground text-sm">
										{mediaKind}
									</Text>
									<View className="mt-1 flex-row items-center gap-1">
										<Text className="font-medium text-primary text-sm">
											Explore title
										</Text>
										<ArrowRight color="#60a5fa" size={16} />
									</View>
								</View>
							</Pressable>
						</Link>
					) : null}

					<View className="gap-3">
						<Text
							selectable
							className="font-bold font-display text-2xl text-foreground"
						>
							{review.title}
						</Text>
						<View className="flex-row items-center justify-between gap-3">
							<Link href={`/profile/${review.author.handle}` as Href} asChild>
								<Pressable className="min-w-0 flex-1 flex-row items-center gap-2 active:opacity-70">
									<View className="size-7 items-center justify-center overflow-hidden rounded-full bg-background-subtle">
										{review.author.avatar ? (
											<Image
												source={{ uri: review.author.avatar }}
												style={{ width: 28, height: 28 }}
												contentFit="cover"
											/>
										) : (
											<User color="#94a3b8" size={15} />
										)}
									</View>
									<Text
										selectable
										className="text-foreground text-sm"
										numberOfLines={1}
									>
										{review.author.displayName || review.author.handle}
									</Text>
								</Pressable>
							</Link>
							<View className="flex-row items-center gap-1.5">
								<CalendarDays color="#94a3b8" size={14} />
								<Text selectable className="text-muted-foreground text-xs">
									{new Date(review.createdAt).toLocaleDateString()}
								</Text>
							</View>
						</View>
					</View>

					<SpoilerShield spoiler={review.spoiler} authorDid={review.author.did}>
						<Markdown value={review.markdown} />
					</SpoilerShield>
				</ScrollView>
			)}
		</View>
	);
}
