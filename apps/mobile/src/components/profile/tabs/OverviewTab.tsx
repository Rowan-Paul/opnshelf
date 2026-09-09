import type { PublicUserProfileDto } from "@opnshelf/api";
import { type Href, Link } from "expo-router";
import {
	ChevronRight,
	Clock,
	Film,
	Heart,
	Star,
	Tv,
} from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { shelfItemToCardItem } from "@/components/home/ShelfPreviewRow";
import { MediaCard, type MediaCardItem } from "@/components/media/MediaCard";
import { ProfileContentCard } from "@/components/profile/ProfileContentCard";
import { ProfileReviewRating } from "@/components/profile/ProfileReviewRating";
import type { ProfileTab } from "@/components/profile/ProfileTabBar";
import { StatsStrip } from "@/components/profile/StatsStrip";
import { ReviewBody } from "@/components/ReviewBody";
import { Text } from "@/components/ui/text";
import { mediaHref } from "@/lib/media-href";
import {
	useProfileLists,
	useProfileReviews,
	useProfileShelf,
} from "@/lib/use-public-profile";

const POSTER_W = 120;

function ViewAll() {
	return (
		<View className="flex-row items-center gap-1">
			<Text className="font-medium text-primary text-sm">View all</Text>
			<ChevronRight color="#f3bc00" size={15} />
		</View>
	);
}

function SectionHeader({
	icon,
	title,
	onPressAll,
	href,
}: {
	icon: React.ReactNode;
	title: string;
	onPressAll?: () => void;
	/** When set, "View all" is a deep link instead of a callback. */
	href?: Href;
}) {
	return (
		<View className="mb-3 flex-row items-center justify-between">
			<View className="flex-row items-center gap-2">
				{icon}
				<Text className="font-bold font-display text-foreground text-lg">
					{title}
				</Text>
			</View>
			{href ? (
				<Link href={href} asChild>
					<Pressable className="flex-row items-center gap-1">
						<ViewAll />
					</Pressable>
				</Link>
			) : onPressAll ? (
				<Pressable onPress={onPressAll} className="flex-row items-center gap-1">
					<ViewAll />
				</Pressable>
			) : null}
		</View>
	);
}

/** A poster plus the profile owner's Watch count for it, when known. */
type PosterRowItem = { card: MediaCardItem; watchCount?: number };

function PosterRow({
	items,
	emptyText,
}: {
	items: PosterRowItem[];
	emptyText: string;
}) {
	if (items.length === 0) {
		return (
			<View className="items-center rounded-xl border border-border bg-card p-6">
				<Text className="text-muted-foreground text-sm">{emptyText}</Text>
			</View>
		);
	}
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false}>
			<View className="flex-row gap-3">
				{items.map(({ card, watchCount }, index) => (
					<View
						// biome-ignore lint/suspicious/noArrayIndexKey: rewatches share a media key in this static, non-reordering row, so index disambiguates
						key={`${card.type}-${card.id}-${card.episode?.seasonNumber ?? ""}-${card.episode?.episodeNumber ?? ""}-${index}`}
						style={{ width: POSTER_W }}
					>
						<MediaCard item={card} actions watchCount={watchCount} />
					</View>
				))}
			</View>
		</ScrollView>
	);
}

/**
 * Overview tab: stats strip, recent movies + episodes rows, watchlist /
 * favorites previews, and recent reviews — mirroring the web profile overview.
 * `onNavigate` switches the parent screen to a deeper tab on "View all".
 */
export function OverviewTab({
	profile,
	userDid,
	onNavigate,
}: {
	profile: PublicUserProfileDto | undefined;
	userDid: string;
	onNavigate: (tab: ProfileTab, shelfType?: "movie" | "episode") => void;
}) {
	// Both rows read the shelf endpoint rather than the dedicated recent-movies /
	// recent-episodes ones: its DTO carries the episode title and the profile
	// owner's Watch counts, so these posters badge like the Shelf tab does.
	const movies = useProfileShelf(userDid, { type: "movie" });
	const episodes = useProfileShelf(userDid, { type: "episode" });
	const lists = useProfileLists(userDid);
	const reviews = useProfileReviews(userDid, undefined, 4);

	const movieItems: PosterRowItem[] = (movies.data?.items ?? [])
		.slice(0, 10)
		.map((item) => ({
			card: shelfItemToCardItem(item),
			watchCount: item.watchCount,
		}));

	const episodeItems: PosterRowItem[] = (episodes.data?.items ?? [])
		.slice(0, 10)
		.map((item) => ({
			card: shelfItemToCardItem(item),
			watchCount: item.watchCount,
		}));

	const watchlist = lists.data?.find((l) => l.slug === "watchlist");
	const favorites = lists.data?.find((l) => l.slug === "favorites");

	const reviewItems = reviews.data?.items ?? [];

	return (
		<View className="gap-8 px-4 pt-4 pb-12">
			<StatsStrip
				activity={profile?.activityLast30Days}
				mostWatchedShow={profile?.mostWatchedShow ?? null}
				watchedThisYear={profile?.watchedThisYear ?? 0}
				reviewsCount={profile?.reviewsCount ?? 0}
				isLoading={!profile}
			/>

			<View>
				<SectionHeader
					icon={<Film color="#f3bc00" size={18} />}
					title="Recent Movies"
					onPressAll={() => onNavigate("shelf", "movie")}
				/>
				<PosterRow items={movieItems} emptyText="No movies watched yet." />
			</View>

			<View>
				<SectionHeader
					icon={<Tv color="#f3bc00" size={18} />}
					title="Recent Episodes"
					onPressAll={() => onNavigate("shelf", "episode")}
				/>
				<PosterRow items={episodeItems} emptyText="No episodes watched yet." />
			</View>

			<ListPreview
				title="Watchlist"
				icon={<Clock color="#f3bc00" size={18} />}
				list={watchlist}
				emptyText="Nothing on watchlist"
				onPressAll={() => onNavigate("lists")}
			/>
			<ListPreview
				title="Favorites"
				icon={<Heart color="#f3bc00" size={18} />}
				list={favorites}
				emptyText="Nothing on favorites"
				onPressAll={() => onNavigate("lists")}
			/>

			<View>
				<SectionHeader
					icon={<Star color="#f3bc00" size={18} />}
					title="Recent Reviews"
					onPressAll={() => onNavigate("reviews")}
				/>
				{reviewItems.length === 0 ? (
					<View className="items-center rounded-xl border border-border bg-card p-6">
						<Text className="text-muted-foreground text-sm">
							No reviews yet.
						</Text>
					</View>
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
								headerRight={
									<ProfileReviewRating authorRating={review.authorRating} />
								}
							>
								{review.markdown ? (
									<ReviewBody
										markdown={review.markdown}
										href={
											profile?.handle
												? (`/reviews/${profile.handle}/${review.rkey}` as Href)
												: undefined
										}
									/>
								) : null}
							</ProfileContentCard>
						))}
					</View>
				)}
			</View>
		</View>
	);
}

function ListPreview({
	title,
	icon,
	list,
	emptyText,
	onPressAll,
}: {
	title: string;
	icon: React.ReactNode;
	list?: { slug: string; itemCount: number };
	emptyText: string;
	onPressAll: () => void;
}) {
	// Reuse the lists list-summary; the overview doesn't fetch items per list to
	// keep the request count down — it links straight into the Lists tab.
	const count = list?.itemCount ?? 0;
	return (
		<View>
			<SectionHeader
				icon={icon}
				title={title}
				onPressAll={list ? onPressAll : undefined}
			/>
			{!list || count === 0 ? (
				<View className="items-center rounded-xl border border-border bg-card p-6">
					<Text className="text-muted-foreground text-sm">{emptyText}</Text>
				</View>
			) : (
				<Pressable
					onPress={onPressAll}
					className="flex-row items-center justify-between rounded-xl border border-border bg-card p-4"
				>
					<Text className="font-medium text-foreground text-sm">
						{count} item{count === 1 ? "" : "s"}
					</Text>
					<ChevronRight color="#94a3b8" size={18} />
				</Pressable>
			)}
		</View>
	);
}
