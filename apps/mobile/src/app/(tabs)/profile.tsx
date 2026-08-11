import { type Href, Link, router } from "expo-router";
import {
	ChevronRight,
	Clock,
	Disc,
	Film,
	List,
	LogOut,
	Pencil,
	Settings,
	Star,
} from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SectionHeader } from "@/components/home/SectionHeader";
import { shelfItemToCardItem } from "@/components/home/ShelfPreviewRow";
import { MediaCard } from "@/components/media/MediaCard";
import { ProfileContentCard } from "@/components/profile/ProfileContentCard";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { libraryItemToCardItem } from "@/components/profile/tabs/LibraryTab";
import { useDialog } from "@/components/ui/dialog";
import { Markdown } from "@/components/ui/Markdown";
import {
	ListRowsSkeleton,
	PosterRowSkeleton,
	ProfileHeaderSkeleton,
	ReviewsSkeleton,
} from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { UpNextCard } from "@/components/up-next/UpNextCard";
import { UpNextSkeleton } from "@/components/up-next/UpNextSkeleton";
import { useAuth } from "@/lib/auth-context";
import { mediaHref } from "@/lib/media-href";
import { useTheme } from "@/lib/theme-context";
import { useUserLibrary } from "@/lib/use-library";
import {
	useProfileLists,
	useProfileReviews,
	useProfileShelf,
	useProfileUpNext,
	usePublicProfile,
} from "@/lib/use-public-profile";
import { useRefreshActiveQueries } from "@/lib/use-refresh";

const POSTER_W = 110;

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
	const { scheme } = useTheme();
	const { showDialog } = useDialog();
	const handle = user?.handle ?? "";

	const { data: profile, isLoading, isError } = usePublicProfile(handle);
	const userDid = profile?.did ?? "";

	const shelf = useProfileShelf(userDid, { page: 1 });
	const upNext = useProfileUpNext(userDid);
	const lists = useProfileLists(userDid);
	const library = useUserLibrary(userDid);
	const reviews = useProfileReviews(userDid, undefined, 3);
	const { refreshing, onRefresh } = useRefreshActiveQueries();

	const shelfHref = `/profile/${handle}/shelf` as Href;
	const upNextHref = `/profile/${handle}/up-next` as Href;
	const reviewsHref = `/profile/${handle}/reviews` as Href;
	const libraryHref = `/profile/${handle}?tab=library` as Href;

	const shelfItems = (shelf.data?.items ?? []).slice(0, 10);
	const upNextItems = (upNext.data?.items ?? []).slice(0, 4);
	const listItems = (lists.data ?? []).slice(0, 4);
	const libraryItems = (library.data ?? []).slice(0, 10);
	const reviewItems = (reviews.data?.items ?? []).slice(0, 3);

	const goToConnections = (tab: "followers" | "following") => {
		router.push(`/profile/${handle}/connections?tab=${tab}` as Href);
	};

	const confirmSignOut = () => {
		showDialog({
			title: "Sign out",
			description: "Are you sure you want to sign out?",
			actions: [
				{ label: "Cancel" },
				{
					label: "Sign out",
					variant: "destructive",
					onPress: () => {
						void signOut();
					},
				},
			],
		});
	};

	return (
		<View className="flex-1 bg-background">
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 32 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor="#f3bc00"
						colors={["#f3bc00"]}
					/>
				}
			>
				{/* Top bar with quick access to settings. */}
				<View className="flex-row items-center justify-between px-4 pt-3 pb-3">
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
					<>
						<ProfileHeaderSkeleton />
						<View className="gap-8 px-4 pt-6">
							<PosterRowSkeleton />
							<UpNextSkeleton />
							<ListRowsSkeleton />
						</View>
					</>
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
								{shelf.isPending ? (
									<PosterRowSkeleton />
								) : shelfItems.length === 0 ? (
									<EmptyPreview text="Nothing on your shelf yet." />
								) : (
									<ScrollView horizontal showsHorizontalScrollIndicator={false}>
										<View className="flex-row gap-3">
											{shelfItems.map((item) => (
												<View key={item.id} style={{ width: POSTER_W }}>
													<MediaCard item={shelfItemToCardItem(item)} actions />
												</View>
											))}
										</View>
									</ScrollView>
								)}
							</View>

							{/* Up Next preview — same card layout as the dashboard + the
							    full Up Next screen. */}
							<View>
								<SectionHeader icon={Clock} title="Up Next" href={upNextHref} />
								{upNext.isPending ? (
									<UpNextSkeleton />
								) : upNextItems.length === 0 ? (
									<EmptyPreview text="You're all caught up." />
								) : (
									<View className="gap-3">
										{upNextItems.map((item) => (
											<UpNextCard
												key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
												item={item}
											/>
										))}
									</View>
								)}
							</View>

							{/* Lists preview */}
							<View>
								<SectionHeader icon={List} title="Lists" href="/lists" />
								{lists.isPending ? (
									<ListRowsSkeleton />
								) : listItems.length === 0 ? (
									<EmptyPreview text="No lists yet." />
								) : (
									<View className="gap-2">
										{listItems.map((list) => (
											<Link
												key={list.id}
												// Self hub: always the owner's manageable list screen
												href={`/lists/${list.slug}` as Href}
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

							{/* Library preview — owned films, poster row like Shelf */}
							<View>
								<SectionHeader icon={Disc} title="Library" href={libraryHref} />
								{library.isPending ? (
									<PosterRowSkeleton />
								) : libraryItems.length === 0 ? (
									<EmptyPreview text="Nothing owned yet." />
								) : (
									<ScrollView horizontal showsHorizontalScrollIndicator={false}>
										<View className="flex-row gap-3">
											{libraryItems.map((item) => (
												<View key={item.id} style={{ width: POSTER_W }}>
													<MediaCard item={libraryItemToCardItem(item)} />
												</View>
											))}
										</View>
									</ScrollView>
								)}
							</View>

							{/* Reviews preview */}
							<View>
								<SectionHeader icon={Star} title="Reviews" href={reviewsHref} />
								{reviews.isPending ? (
									<ReviewsSkeleton rows={1} />
								) : reviewItems.length === 0 ? (
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
												href={mediaHref({ ...review, reviewId: review.id })}
												title={review.mediaLabel || "Unknown"}
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

							{/* Sign out — reversible, so a neutral treatment (matches the
							    settings screen); red stays reserved for destructive actions. */}
							<Pressable
								onPress={confirmSignOut}
								className="mt-2 flex-row items-center justify-center gap-2 rounded-lg border border-border py-3"
							>
								<LogOut
									color={scheme === "dark" ? "#f8fafc" : "#0f172a"}
									size={18}
								/>
								<Text className="font-semibold text-foreground text-sm">
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
