import type { ShelfResponseDto, UpNextShowDto } from "@opnshelf/api";
import { type Href, Link, router } from "expo-router";
import {
	ChevronRight,
	Clock,
	Film,
	List,
	LogOut,
	Pencil,
	Settings,
	Star,
	Tv,
} from "lucide-react-native";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SectionHeader } from "@/components/home/SectionHeader";
import { MediaCard, type MediaCardItem } from "@/components/media/MediaCard";
import { PosterImage } from "@/components/media/PosterImage";
import { ProfileContentCard } from "@/components/profile/ProfileContentCard";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { Markdown } from "@/components/ui/Markdown";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { mediaHref } from "@/lib/media-href";
import { posterUrl } from "@/lib/tmdb";
import {
	useProfileLists,
	useProfileReviews,
	useProfileShelf,
	useProfileUpNext,
	usePublicProfile,
} from "@/lib/use-public-profile";

const POSTER_W = 110;

/** Map a shelf entry to a MediaCard item (episodes link to their parent show). */
function toMediaCardItem(
	item: ShelfResponseDto["items"][number],
): MediaCardItem {
	if (item.type === "movie") {
		return {
			id: Number(item.movieId),
			type: "movie",
			title: item.title,
			posterPath: item.posterPath,
			year: item.releaseYear ? String(item.releaseYear) : undefined,
		};
	}
	return {
		id: Number(item.showId),
		type: "show",
		title: item.showTitle,
		posterPath: item.posterPath,
		year: item.firstAirYear ? String(item.firstAirYear) : undefined,
	};
}

/**
 * Self-profile tab (issue #151, nav concept A — hub + drill-down). Replaces the
 * old quick-links Profile tab and the standalone Shelf tab. A single scroll:
 * header (avatar, counts, edit/settings/sign-out surfaced) → preview sections
 * for Shelf, Up Next, Lists, and Reviews, each "View all ›" pushing a dedicated
 * full page. No internal tab bar and no stats strip here — stats live on Home.
 * Other users' profiles still use the richer `/profile/[handle]` screen.
 */
export default function ProfileTab() {
	const insets = useSafeAreaInsets();
	const { user, isAuthenticated, signOut } = useAuth();
	const handle = user?.handle ?? "";

	const { data: profile, isLoading, isError } = usePublicProfile(handle);
	const userDid = profile?.did ?? "";

	const shelf = useProfileShelf(userDid, { page: 1 });
	const upNext = useProfileUpNext(userDid);
	const lists = useProfileLists(userDid);
	const reviews = useProfileReviews(userDid, undefined, 3);

	const shelfHref = `/profile/${handle}/shelf` as Href;
	const upNextHref = `/profile/${handle}/up-next` as Href;
	const reviewsHref = `/profile/${handle}/reviews` as Href;

	const shelfItems = (shelf.data?.items ?? [])
		.slice(0, 10)
		.map(toMediaCardItem);
	const upNextItems = (upNext.data?.items ?? []).slice(0, 10);
	const listItems = (lists.data ?? []).slice(0, 4);
	const reviewItems = (reviews.data?.items ?? []).slice(0, 3);

	const goToConnections = (tab: "followers" | "following") => {
		router.push(`/profile/${handle}/connections?tab=${tab}` as Href);
	};

	const confirmSignOut = () => {
		Alert.alert("Sign out", "Are you sure you want to sign out?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Sign out",
				style: "destructive",
				onPress: () => {
					void signOut();
				},
			},
		]);
	};

	return (
		<View className="flex-1 bg-background">
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 32 }}
			>
				{/* Top bar with quick access to settings. */}
				<View className="flex-row items-center justify-between px-4 pt-2 pb-1">
					<Text className="font-bold font-display text-2xl text-foreground">
						Profile
					</Text>
					<Link href="/settings" asChild>
						<Pressable hitSlop={8} className="p-1">
							<Settings color="#94a3b8" size={22} />
						</Pressable>
					</Link>
				</View>

				{isLoading ? (
					<LoadingState />
				) : isError || !profile ? (
					<ErrorState
						title="Couldn't load your profile"
						message="Pull down or try again in a moment."
					/>
				) : (
					<>
						<ProfileHeader
							profile={profile}
							handle={profile.handle}
							isOwner
							isAuthenticated={isAuthenticated}
							onPressConnections={goToConnections}
						/>

						{/* Edit profile — surfaced inline per the redesign. */}
						<View className="px-4">
							<Link href="/edit-profile" asChild>
								<Pressable className="flex-row items-center justify-center gap-2 rounded-lg border border-border py-2.5">
									<Pencil color="#94a3b8" size={16} />
									<Text className="font-semibold text-foreground text-sm">
										Edit profile
									</Text>
								</Pressable>
							</Link>
						</View>

						<View className="gap-8 px-4 pt-6">
							{/* Shelf preview */}
							<View>
								<SectionHeader icon={Film} title="Shelf" href={shelfHref} />
								{shelfItems.length === 0 ? (
									<EmptyPreview text="Nothing on your shelf yet." />
								) : (
									<ScrollView horizontal showsHorizontalScrollIndicator={false}>
										<View className="flex-row gap-3">
											{shelfItems.map((item) => (
												<View
													key={`${item.type}-${item.id}`}
													style={{ width: POSTER_W }}
												>
													<MediaCard item={item} actions />
												</View>
											))}
										</View>
									</ScrollView>
								)}
							</View>

							{/* Up Next preview */}
							<View>
								<SectionHeader icon={Clock} title="Up Next" href={upNextHref} />
								{upNextItems.length === 0 ? (
									<EmptyPreview text="You're all caught up." />
								) : (
									<ScrollView horizontal showsHorizontalScrollIndicator={false}>
										<View className="flex-row gap-3">
											{upNextItems.map((item) => (
												<UpNextPoster key={item.showId} item={item} />
											))}
										</View>
									</ScrollView>
								)}
							</View>

							{/* Lists preview */}
							<View>
								<SectionHeader icon={List} title="Lists" href="/lists" />
								{listItems.length === 0 ? (
									<EmptyPreview text="No lists yet." />
								) : (
									<View className="gap-2">
										{listItems.map((list) => (
											<Link
												key={list.id}
												href={
													`/list/${encodeURIComponent(userDid)}/${list.slug}` as Href
												}
												asChild
											>
												<Pressable className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
													<View className="min-w-0 flex-1">
														<Text
															className="font-semibold text-foreground"
															numberOfLines={1}
														>
															{list.name}
														</Text>
														<Text className="mt-0.5 text-muted-foreground text-xs">
															{list.itemCount} item
															{list.itemCount === 1 ? "" : "s"}
														</Text>
													</View>
													<ChevronRight color="#94a3b8" size={18} />
												</Pressable>
											</Link>
										))}
									</View>
								)}
							</View>

							{/* Reviews preview */}
							<View>
								<SectionHeader icon={Star} title="Reviews" href={reviewsHref} />
								{reviewItems.length === 0 ? (
									<EmptyPreview text="No reviews yet." />
								) : (
									<View className="gap-3">
										{reviewItems.map((review) => (
											<ProfileContentCard
												key={review.id}
												posterUrl={
													review.posterPath
														? `https://image.tmdb.org/t/p/w300${review.posterPath}`
														: undefined
												}
												href={mediaHref(review)}
												title={review.title || "Unknown"}
												meta={review.reviewTitle}
											>
												{review.markdown ? (
													<View className="max-h-24 overflow-hidden">
														<Markdown value={review.markdown} />
													</View>
												) : null}
											</ProfileContentCard>
										))}
									</View>
								)}
							</View>

							{/* Sign out — surfaced per the redesign. */}
							<Pressable
								onPress={confirmSignOut}
								className="mt-2 flex-row items-center justify-center gap-2 rounded-lg border border-border py-3"
							>
								<LogOut color="#ef4444" size={18} />
								<Text className="font-semibold text-destructive text-sm">
									Sign out
								</Text>
							</Pressable>
						</View>
					</>
				)}
			</ScrollView>
		</View>
	);
}

function EmptyPreview({ text }: { text: string }) {
	return (
		<View className="items-center rounded-xl border border-border bg-card p-6">
			<Text className="text-muted-foreground text-sm">{text}</Text>
		</View>
	);
}

/** Compact Up Next poster linking straight to the next unwatched episode. */
function UpNextPoster({ item }: { item: UpNextShowDto }) {
	const next = item.nextEpisode;
	return (
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
			<Pressable style={{ width: POSTER_W }}>
				<View className="overflow-hidden rounded-lg border border-border bg-card">
					<PosterImage
						url={posterUrl(item.show.posterPath, "w342")}
						className="aspect-2/3 w-full"
					/>
				</View>
				<Text
					className="mt-2 font-medium text-foreground text-sm"
					numberOfLines={1}
				>
					{item.show.title}
				</Text>
				<View className="mt-0.5 flex-row items-center gap-1">
					<Tv color="#94a3b8" size={11} />
					<Text className="text-muted-foreground text-xs">
						S{next.seasonNumber}E{next.episodeNumber}
					</Text>
				</View>
			</Pressable>
		</Link>
	);
}
