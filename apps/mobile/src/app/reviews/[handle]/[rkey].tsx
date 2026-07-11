import { reviewsControllerGetCanonicalReviewOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { type Href, Link, Stack, useLocalSearchParams } from "expo-router";
import { User } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
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
					contentContainerClassName="gap-4 p-4 pb-12"
				>
					<View className="flex-row gap-4">
						{poster ? (
							<Link
								href={
									mediaHref({
										mediaType: review.mediaType,
										mediaId: review.mediaId,
										seasonNumber: review.seasonNumber,
										episodeNumber: review.episodeNumber,
									}) as Href
								}
								asChild
							>
								<Pressable>
									<Image
										source={{ uri: poster }}
										style={{ width: 96, height: 144, borderRadius: 8 }}
										contentFit="cover"
									/>
								</Pressable>
							</Link>
						) : null}
						<View className="flex-1 gap-1">
							<Text className="font-bold font-display text-foreground text-xl">
								{review.title}
							</Text>
							{review.mediaTitle ? (
								<Text className="text-muted-foreground text-sm">
									{review.mediaTitle}
								</Text>
							) : null}
							<Link href={`/profile/${review.author.handle}` as Href} asChild>
								<Pressable className="mt-1 flex-row items-center gap-2">
									<View className="size-6 items-center justify-center overflow-hidden rounded-full bg-background-subtle">
										{review.author.avatar ? (
											<Image
												source={{ uri: review.author.avatar }}
												style={{ width: 24, height: 24 }}
												contentFit="cover"
											/>
										) : (
											<User color="#94a3b8" size={14} />
										)}
									</View>
									<Text className="text-foreground text-sm" numberOfLines={1}>
										{review.author.displayName || review.author.handle}
									</Text>
								</Pressable>
							</Link>
						</View>
					</View>

					<Markdown value={review.markdown} />
				</ScrollView>
			)}
		</View>
	);
}
