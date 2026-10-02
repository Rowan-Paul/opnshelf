import { type Href, Link, router } from "expo-router";
import {
	ChevronRight,
	Clock,
	Disc,
	Film,
	List,
	type LucideIcon,
	Pencil,
	Settings,
	Star,
	Users,
} from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SectionHeader } from "@/components/home/SectionHeader";
import { shelfItemToCardItem } from "@/components/home/ShelfPreviewRow";
import { MediaCard, type MediaCardItem } from "@/components/media/MediaCard";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import {
	PosterRowSkeleton,
	ProfileHeaderSkeleton,
} from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useProfileShelf, usePublicProfile } from "@/lib/use-public-profile";
import { useRefreshActiveQueries } from "@/lib/use-refresh";

const POSTER_W = 110;

/** Personal hub; public profiles keep their separate browsing layout. */
export default function ProfileTab() {
	const insets = useSafeAreaInsets();
	const { user, isAuthenticated } = useAuth();
	const handle = user?.handle ?? "";
	const { data: profile, isPending, refetch } = usePublicProfile(handle);
	const userDid = profile?.did ?? "";
	const shelf = useProfileShelf(userDid, { pageSize: 10 });
	const { refreshing, onRefresh } = useRefreshActiveQueries();
	const shelfHref = `/profile/${handle}/shelf` as Href;
	const publicHref = `/profile/${handle}` as Href;
	const shelfItems = shelf.data?.items ?? [];

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
				<View className="flex-row items-center justify-between px-4 pt-3 pb-3">
					<Text className="font-bold font-display text-2xl text-foreground">
						Your profile
					</Text>
					<Link href="/settings" asChild>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Settings"
							className="size-11 items-center justify-center"
						>
							<Settings color="#94a3b8" size={22} />
						</Pressable>
					</Link>
				</View>
				{isPending ? (
					<>
						<ProfileHeaderSkeleton />
						<View className="gap-6 px-4">
							<View className="h-11 rounded-lg bg-background-subtle" />
							<View className="flex-row flex-wrap gap-3">
								{[0, 1, 2, 3].map((key) => (
									<View
										key={key}
										className="h-24 grow basis-2/5 rounded-xl bg-background-subtle"
									/>
								))}
							</View>
						</View>
					</>
				) : !profile ? (
					<ErrorState
						title="Couldn't load your profile"
						message="Pull down or try again."
						onRetry={() => void refetch()}
					/>
				) : (
					<>
						<ProfileHeader
							profile={profile}
							handle={profile.handle}
							isOwner
							isAuthenticated={isAuthenticated}
							onPressConnections={(tab) =>
								router.push(`/profile/${handle}/connections?tab=${tab}` as Href)
							}
						/>
						<View className="gap-6 px-4">
							<View className="flex-row gap-3">
								<Link href="/edit-profile" asChild>
									<Pressable
										accessibilityRole="button"
										className="min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border px-2 py-2.5"
									>
										<Pencil color="#94a3b8" size={16} />
										<Text className="font-semibold text-foreground text-sm">
											Edit profile
										</Text>
									</Pressable>
								</Link>
								<Link href={publicHref} asChild>
									<Pressable
										accessibilityRole="link"
										className="min-h-11 flex-1 items-center justify-center rounded-lg border border-border px-2 py-2.5"
									>
										<Text className="text-center font-semibold text-foreground text-sm">
											View public profile
										</Text>
									</Pressable>
								</Link>
							</View>

							<View className="flex-row flex-wrap gap-3">
								<Destination
									icon={Film}
									title="Shelf"
									detail="Your Watches"
									href={shelfHref}
								/>
								<Destination
									icon={List}
									title="Lists"
									detail="Your curated picks"
									href="/lists"
								/>
								<Destination
									icon={Disc}
									title="Library"
									detail="Films you own"
									href={`${publicHref}?tab=library` as Href}
								/>
								<Destination
									icon={Star}
									title="Reviews"
									detail="Your writing"
									href={`/profile/${handle}/reviews` as Href}
								/>
							</View>

							<LinkRow
								icon={Clock}
								title="Up Next"
								detail="Continue your shows"
								href={`/profile/${handle}/up-next` as Href}
							/>

							<View>
								<SectionHeader
									icon={Film}
									title="Recently watched"
									href={shelfHref}
								/>
								{shelf.isPending ? (
									<PosterRowSkeleton />
								) : !shelf.data && shelf.isError ? (
									<ErrorState
										title="Couldn't load your Shelf"
										onRetry={() => void shelf.refetch()}
									/>
								) : shelfItems.length ? (
									<PosterRow
										items={shelfItems.map((item) => ({
											key: item.id,
											card: shelfItemToCardItem(item),
											watchCount: item.watchCount,
										}))}
									/>
								) : (
									<EmptyPreview
										text="Your watching history starts with your first Watch."
										href="/search"
										label="Find something to watch"
									/>
								)}
							</View>

							<LinkRow
								icon={Users}
								title="Find people"
								detail="Find people to follow in Social"
								href="/social/find"
							/>
						</View>
					</>
				)}
			</ScrollView>
		</View>
	);
}

function PosterRow({
	items,
}: {
	items: { key: string; card: MediaCardItem; watchCount?: number }[];
}) {
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false}>
			<View className="flex-row gap-3">
				{items.map(({ key, card, watchCount }) => (
					<View key={key} style={{ width: POSTER_W }}>
						<MediaCard item={card} watchCount={watchCount} />
					</View>
				))}
			</View>
		</ScrollView>
	);
}

function Destination({
	icon: Icon,
	title,
	detail,
	href,
}: {
	icon: LucideIcon;
	title: string;
	detail: string;
	href: Href;
}) {
	return (
		<Link href={href} asChild>
			<Pressable
				accessibilityRole="link"
				className="grow basis-2/5 gap-2 rounded-xl border border-border bg-card p-4"
			>
				<Icon color="#f3bc00" size={20} />
				<View>
					<Text className="font-display font-semibold text-base text-foreground">
						{title}
					</Text>
					<Text className="mt-1 text-muted-foreground text-xs">{detail}</Text>
				</View>
			</Pressable>
		</Link>
	);
}

function LinkRow({
	icon: Icon,
	title,
	detail,
	href,
}: {
	icon: LucideIcon;
	title: string;
	detail: string;
	href: Href;
}) {
	return (
		<Link href={href} asChild>
			<Pressable
				accessibilityRole="link"
				className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4"
			>
				<Icon color="#f3bc00" size={20} />
				<View className="flex-1">
					<Text className="font-semibold text-foreground">{title}</Text>
					<Text className="mt-1 text-muted-foreground text-xs">{detail}</Text>
				</View>
				<ChevronRight color="#94a3b8" size={18} />
			</Pressable>
		</Link>
	);
}

function EmptyPreview({
	text,
	href,
	label,
}: {
	text: string;
	href: Href;
	label: string;
}) {
	return (
		<View className="gap-3 rounded-xl border border-border bg-card p-4">
			<Text className="text-muted-foreground text-sm">{text}</Text>
			<Link href={href} asChild>
				<Pressable accessibilityRole="link" className="min-h-11 justify-center">
					<Text className="font-semibold text-primary text-sm">{label}</Text>
				</Pressable>
			</Link>
		</View>
	);
}
