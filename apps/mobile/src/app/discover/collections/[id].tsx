import {
	getHttpStatus,
	type NotificationCollectionItemDto,
	notificationsControllerCollection,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { type Href, Link, Stack, useLocalSearchParams } from "expo-router";
import { Bookmark, Check } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PosterImage } from "@/components/media/PosterImage";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { posterUrl } from "@/lib/tmdb";
import { useListMembership } from "@/lib/use-lists";

export default function NotificationCollectionScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
	const insets = useSafeAreaInsets();
	const query = useQuery({
		queryFn: async ({ signal }) =>
			(
				await notificationsControllerCollection({
					path: { id },
					signal,
					throwOnError: true,
				})
			).data,
		queryKey: ["notification-collection", user?.did, id],
		enabled: isAuthenticated && !!id,
		retry: (count, error) => getHttpStatus(error) !== 404 && count < 2,
	});
	const collection = isAuthenticated ? query.data : undefined;
	return (
		<ScrollView
			className="flex-1 bg-background"
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={{
				padding: 20,
				paddingBottom: insets.bottom + 24,
				gap: 24,
			}}
		>
			<Stack.Screen options={{ headerShown: true, title: "Discover" }} />
			{!authLoading && !isAuthenticated ? (
				<View className="gap-4">
					<Text className="font-bold font-display text-2xl">
						Your release collection
					</Text>
					<Text>
						Sign in to the account that received this notification, then open
						its link again.
					</Text>
					<Link href="/login" className="text-primary">
						Sign in
					</Link>
				</View>
			) : collection ? (
				<>
					<View className="gap-3">
						<Text selectable className="text-muted-foreground text-sm">
							{collection.periodStart === collection.periodEnd
								? formatDate(collection.periodStart)
								: `${formatDate(collection.periodStart)} – ${formatDate(collection.periodEnd)}`}
						</Text>
						<Text selectable className="font-bold font-display text-3xl">
							{collection.heading}
						</Text>
						<Text selectable className="text-muted-foreground">
							{collection.items.length}{" "}
							{collection.items.length === 1 ? "title" : "titles"} to explore.
							Find your next watch.
						</Text>
					</View>
					{collection.items.map((item) => (
						<CollectionItem key={item.path} item={item} />
					))}

					<Link href="/search" className="font-semibold text-primary">
						Back to Discover
					</Link>
				</>
			) : query.isError ? (
				<ErrorState
					title={
						getHttpStatus(query.error) === 404
							? "Collection unavailable"
							: "Couldn’t load this collection"
					}
					message={
						getHttpStatus(query.error) === 404
							? "Check that you’re signed in to the account that received this notification."
							: "Please try again."
					}
					onRetry={
						getHttpStatus(query.error) === 404
							? undefined
							: () => void query.refetch()
					}
				/>
			) : (
				<CollectionSkeleton />
			)}
		</ScrollView>
	);
}

function formatDate(date: string) {
	return new Date(`${date}T12:00:00Z`).toLocaleDateString("en", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
}

function CollectionItem({ item }: { item: NotificationCollectionItemDto }) {
	const { memberships, toggle, isPending, isLoading } = useListMembership({
		mediaType: item.mediaType,
		mediaId: item.mediaId,
		seasonNumber: item.seasonNumber ?? undefined,
	});
	const isInWatchlist =
		memberships.find((list) => list.listSlug === "watchlist")?.isInList ??
		false;
	return (
		<View className="flex-row items-start gap-4 border-border border-b pb-6">
			<Link href={item.path as Href} asChild>
				<Pressable
					accessibilityLabel={`View ${item.title}`}
					style={{ width: 96 }}
				>
					<PosterImage
						url={posterUrl(item.posterPath)}
						className="aspect-2/3 w-full rounded-lg"
					/>
				</Pressable>
			</Link>
			<View className="min-w-0 flex-1 gap-3">
				<View className="gap-1">
					<Text selectable className="text-muted-foreground text-xs">
						{item.seasonNumber
							? `Season ${item.seasonNumber}`
							: item.mediaType === "movie"
								? "Movie"
								: "Show"}
						{item.releaseDate
							? ` · ${formatDate(item.releaseDate)}`
							: " · Date unavailable"}
					</Text>
					<Link href={item.path as Href}>
						<Text selectable className="font-bold font-display text-xl">
							{item.title}
						</Text>
					</Link>
				</View>
				{item.overview ? (
					<Text
						selectable
						numberOfLines={4}
						className="text-muted-foreground text-sm leading-5"
					>
						{item.overview}
					</Text>
				) : null}
				<Link
					href={item.path as Href}
					className="text-foreground text-sm underline"
				>
					View details
				</Link>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${isInWatchlist ? "Remove" : "Add"} ${item.title} ${isInWatchlist ? "from" : "to"} Watchlist`}
					accessibilityState={{
						disabled: isPending || isLoading,
						busy: isPending,
					}}
					disabled={isPending || isLoading}
					onPress={() => toggle("watchlist", isInWatchlist)}
					className="flex-row items-center justify-center gap-2 self-start rounded-lg border border-border px-3 py-3"
					style={{ opacity: isPending || isLoading ? 0.5 : 1 }}
				>
					{isInWatchlist ? (
						<Check size={16} color="#b88b00" />
					) : (
						<Bookmark size={16} color="#b88b00" />
					)}
					<Text className="font-semibold text-sm">
						{isInWatchlist ? "In Watchlist" : "Watchlist"}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

function CollectionSkeleton() {
	return (
		<View accessibilityLabel="Loading release collection" className="gap-6">
			<View className="h-4 w-40 rounded bg-background-subtle" />
			<View className="h-9 w-3/4 rounded bg-background-subtle" />
			{[0, 1, 2].map((key) => (
				<View key={key} className="flex-row gap-4">
					<View
						style={{ width: 96, height: 144 }}
						className="rounded-lg bg-background-subtle"
					/>
					<View className="flex-1 gap-3">
						<View className="h-6 w-3/4 rounded bg-background-subtle" />
						<View className="h-20 rounded bg-background-subtle" />
						<View className="h-10 w-28 rounded bg-background-subtle" />
					</View>
				</View>
			))}
		</View>
	);
}
