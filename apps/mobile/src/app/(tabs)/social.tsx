import {
	type FollowedActivityItemDto,
	type SocialUserCardDto,
	socialControllerGetFeedInfiniteOptions,
	socialControllerSearchPeopleOptions,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import {
	type LucideIcon,
	MessageCircle,
	Search,
	Users,
	X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActivityCard } from "@/components/social/ActivityCard";
import { CircleFilterBar } from "@/components/social/CircleFilterBar";
import { UserRow } from "@/components/social/UserRow";
import { TourAnchor } from "@/components/tour/WelcomeTour";
import { ReviewsSkeleton, UserRowsSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth-context";
import { posthog } from "@/lib/posthog";
import { useCircles } from "@/lib/use-circles";
import { useDebounce } from "@/lib/use-debounce";
import {
	useFollowing,
	useFollowToggle,
	useSuggestions,
} from "@/lib/use-social";
import { useTwStyle } from "@/lib/use-tw-style";

const PAGE_SIZE = 20;

/**
 * Social is the Activity Feed with supporting Find people and Circles routes.
 * Its tab stays mounted while those routes are open, preserving the selected
 * Circle and the feed's scroll position on return.
 */
export default function SocialScreen() {
	const insets = useSafeAreaInsets();
	const { user } = useAuth();
	const [refreshing, setRefreshing] = useState(false);
	const listStyle = useTwStyle("px-4 pb-8");

	const { data: circles = [] } = useCircles();
	const following = useFollowing(user?.handle ?? "", 1);
	const [activeCircleId, setActiveCircleId] = useState<string | undefined>();

	// If the selected circle was deleted elsewhere, fall back to the full feed.
	useEffect(() => {
		if (activeCircleId && !circles.some((c) => c.id === activeCircleId)) {
			setActiveCircleId(undefined);
		}
	}, [activeCircleId, circles]);

	const {
		data,
		isLoading,
		isError,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
		refetch,
	} = useInfiniteQuery({
		...socialControllerGetFeedInfiniteOptions({
			query: { pageSize: PAGE_SIZE, circleId: activeCircleId },
		}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});

	const items: FollowedActivityItemDto[] =
		data?.pages.flatMap((page) => page.items) ?? [];
	useEffect(() => {
		if (data) posthog?.capture("activity_viewed", { surface: "social" });
	}, [data]);

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} finally {
			setRefreshing(false);
		}
	};

	const refreshControl = (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={onRefresh}
			tintColor="#f3bc00"
			colors={["#f3bc00"]}
		/>
	);

	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
			<TourAnchor id="social" className="px-4 pt-3 pb-3">
				<Text className="font-bold font-display text-2xl text-foreground">
					Social
				</Text>
				<Text className="text-muted-foreground text-sm">
					Recent watches and reviews from people you follow
				</Text>
			</TourAnchor>
			<View className="flex-row gap-2 px-4 pb-3">
				<SocialLink href="/social/find" icon={Search} label="Find people" />
				<SocialLink href="/social/circles" icon={Users} label="Circles" />
			</View>

			{circles.length > 0 && !following.isLoading ? (
				<CircleFilterBar
					circles={circles}
					activeCircleId={activeCircleId}
					onSelect={setActiveCircleId}
				/>
			) : null}

			{following.isLoading || isLoading ? (
				<View className="px-4 pt-3">
					<ReviewsSkeleton rows={3} />
				</View>
			) : following.isError ? (
				<ErrorState
					message="Couldn't load the people you follow."
					onRetry={() => void following.refetch()}
				/>
			) : following.items.length === 0 ? (
				<NoFollowsContent />
			) : isError && items.length === 0 ? (
				<ErrorState
					message="Couldn't load activity."
					onRetry={() => void refetch()}
				/>
			) : items.length === 0 ? (
				<EmptyFeed
					activeCircleId={activeCircleId}
					onShowAll={() => setActiveCircleId(undefined)}
				/>
			) : (
				<FlashList
					data={items}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => <ActivityCard activity={item} />}
					ItemSeparatorComponent={() => <View className="h-5" />}
					contentContainerStyle={listStyle}
					refreshControl={refreshControl}
					onEndReachedThreshold={0.5}
					onEndReached={() => {
						if (hasNextPage && !isFetchingNextPage) fetchNextPage();
					}}
					ListFooterComponent={
						isFetchingNextPage ? (
							<View className="px-4 py-3">
								<ReviewsSkeleton rows={1} />
							</View>
						) : null
					}
				/>
			)}
		</View>
	);
}

function NoFollowsContent() {
	const { user } = useAuth();
	const [query, setQuery] = useState("");
	const debouncedQuery = useDebounce(query.trim(), 350);
	const hasQuery = debouncedQuery.length > 0;
	const searchQuery = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedQuery, pageSize: 20 },
		}),
		enabled: hasQuery,
	});
	const suggestionsQuery = useSuggestions(!hasQuery);
	const people = hasQuery
		? (searchQuery.data?.items ?? [])
		: (suggestionsQuery.data?.items ?? []);
	const isLoading = hasQuery
		? searchQuery.isLoading
		: suggestionsQuery.isLoading;
	const isError = hasQuery ? searchQuery.isError : suggestionsQuery.isError;
	const retry = hasQuery ? searchQuery.refetch : suggestionsQuery.refetch;

	return (
		<ScrollView
			keyboardShouldPersistTaps="handled"
			contentContainerClassName="gap-4 px-4 pb-8 pt-2"
		>
			<View className="gap-1">
				<Text className="font-display font-semibold text-foreground text-lg">
					Find people to follow
				</Text>
				<Text className="text-muted-foreground text-sm">
					Follow people to fill your Activity Feed with their watches and
					reviews.
				</Text>
			</View>
			<TextField
				leading={<Search color="#94a3b8" size={18} />}
				trailing={
					query.length > 0 ? (
						<Pressable hitSlop={8} onPress={() => setQuery("")}>
							<X color="#94a3b8" size={18} />
						</Pressable>
					) : null
				}
				value={query}
				onChangeText={setQuery}
				placeholder="Search people"
				autoCapitalize="none"
				autoCorrect={false}
				returnKeyType="search"
			/>
			<Text className="font-display font-semibold text-base text-foreground">
				{hasQuery ? "Search results" : "Suggested people"}
			</Text>
			{isLoading ? (
				<UserRowsSkeleton />
			) : isError && people.length === 0 ? (
				<ErrorState
					message="Couldn't find people."
					onRetry={() => void retry()}
				/>
			) : people.length > 0 ? (
				<View className="gap-2">
					{people.map((person) => (
						<ActivitySuggestion
							key={person.did}
							person={person}
							isSelf={person.did === user?.did}
						/>
					))}
				</View>
			) : (
				<Text className="text-muted-foreground text-sm">
					{hasQuery
						? `No users match “${debouncedQuery}”.`
						: "No suggestions right now."}
				</Text>
			)}
			<SocialLink
				href="/social/find"
				icon={Search}
				label="More ways to find people"
			/>
		</ScrollView>
	);
}

function SocialLink({
	href,
	icon: Icon,
	label,
}: {
	href: "/social/find" | "/social/circles";
	icon: LucideIcon;
	label: string;
}) {
	return (
		<Link href={href} asChild>
			<Pressable className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
				<Icon color="#94a3b8" size={16} />
				<Text className="font-semibold text-foreground text-sm">{label}</Text>
			</Pressable>
		</Link>
	);
}

function ActivitySuggestion({
	person,
	isSelf,
}: {
	person: SocialUserCardDto;
	isSelf: boolean;
}) {
	const { toggle } = useFollowToggle();
	return <UserRow user={person} isSelf={isSelf} onToggleFollow={toggle} />;
}

function EmptyFeed({
	activeCircleId,
	onShowAll,
}: {
	activeCircleId?: string;
	onShowAll: () => void;
}) {
	return (
		<View className="flex-1 items-center justify-center gap-2 px-8 py-20">
			<MessageCircle color="#94a3b8" size={44} />
			<Text className="text-center font-display font-semibold text-lg">
				{activeCircleId ? "No activity from this Circle" : "No activity yet"}
			</Text>
			<Text className="text-center text-muted-foreground text-sm">
				{activeCircleId
					? "Try another Circle or manage its members."
					: "The people you follow have no recent watches or reviews to show."}
			</Text>
			{activeCircleId ? (
				<View className="mt-2 flex-row gap-2">
					<Link href={`/social/circles/${activeCircleId}` as const} asChild>
						<Pressable className="flex-row items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
							<Users color="#94a3b8" size={16} />
							<Text className="font-semibold text-foreground text-sm">
								Manage Circle
							</Text>
						</Pressable>
					</Link>
					<Pressable
						onPress={onShowAll}
						className="justify-center rounded-lg border border-border px-4 py-2.5"
					>
						<Text className="font-semibold text-primary text-sm">
							Show all activity
						</Text>
					</Pressable>
				</View>
			) : (
				<SocialLink href="/social/find" icon={Search} label="Find people" />
			)}
		</View>
	);
}
