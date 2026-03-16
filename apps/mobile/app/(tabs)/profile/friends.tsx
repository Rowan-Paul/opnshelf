import {
	socialControllerGetFollowersInfiniteOptions,
	socialControllerGetFollowingInfiniteOptions,
	socialControllerSearchPeopleInfiniteOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import {
	keepPreviousData,
	useInfiniteQuery,
	useQuery,
} from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Users } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FriendsSearchResultsSection } from "@/components/social/FriendsSearchResultsSection";
import { type FriendsTab, FriendsTabs } from "@/components/social/FriendsTabs";
import { SocialConnectionsSection } from "@/components/social/SocialConnectionsSection";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/Input";
import { borderRadius, spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

export default function ProfileFriendsScreen() {
	const { tab } = useLocalSearchParams<{ tab?: FriendsTab | string }>();
	const { colors } = useTheme();
	const { user, isAuthenticated, isLoading } = useAuth();
	const [query, setQuery] = useState("");
	const [activeTab, setActiveTab] = useState<FriendsTab>(
		getFriendsTab(tab) ?? "following",
	);
	const debouncedQuery = useDebouncedSearch(query.trim(), DEBOUNCE_MS);
	const hasSearch = debouncedQuery.length >= 2;
	const handle = user?.handle ?? "";
	const profileQuery = useQuery({
		...usersControllerGetPublicProfileOptions({
			path: { handle },
		}),
		enabled: handle.length > 0,
		retry: false,
	});

	useEffect(() => {
		const nextTab = getFriendsTab(tab);
		if (nextTab) {
			setActiveTab(nextTab);
		}
	}, [tab]);

	const searchQuery = useInfiniteQuery({
		...socialControllerSearchPeopleInfiniteOptions({
			query: {
				q: debouncedQuery,
				pageSize: PAGE_SIZE,
			},
		}),
		enabled: Boolean(isAuthenticated && user?.did && hasSearch),
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
		placeholderData: keepPreviousData,
	});
	const followingQuery = useInfiniteQuery({
		...socialControllerGetFollowingInfiniteOptions({
			path: { handle },
			query: { pageSize: PAGE_SIZE },
		}),
		enabled: Boolean(user?.did && handle && activeTab === "following"),
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});
	const followersQuery = useInfiniteQuery({
		...socialControllerGetFollowersInfiniteOptions({
			path: { handle },
			query: { pageSize: PAGE_SIZE },
		}),
		enabled: Boolean(user?.did && handle && activeTab === "followers"),
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});

	const searchResults = useMemo(
		() =>
			hasSearch
				? (searchQuery.data?.pages ?? []).flatMap((page) => page.items)
				: [],
		[hasSearch, searchQuery.data],
	);
	const followingItems = useMemo(
		() => (followingQuery.data?.pages ?? []).flatMap((page) => page.items),
		[followingQuery.data],
	);
	const followerItems = useMemo(
		() => (followersQuery.data?.pages ?? []).flatMap((page) => page.items),
		[followersQuery.data],
	);

	if (isLoading) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top", "left", "right", "bottom"]}
			>
				<View style={styles.centerContent}>
					<Text style={{ color: colors.onBackground }}>Loading…</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (!isAuthenticated || !user) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top", "left", "right", "bottom"]}
			>
				<View style={styles.centerContent}>
					<Card
						style={{
							...styles.stateCard,
							backgroundColor: colors.surfaceContainerHigh,
							borderColor: colors.outlineVariant,
						}}
					>
						<CardHeader>
							<Text style={[styles.stateTitle, { color: colors.onSurface }]}>
								Find friends
							</Text>
							<Text
								style={[
									styles.stateDescription,
									{ color: colors.onSurfaceVariant },
								]}
							>
								Sign in to search for OpnShelf users and manage your friends.
							</Text>
						</CardHeader>
						<CardContent>
							<Button onPress={() => router.push("/login")}>
								<Text style={{ color: colors.onPrimary }}>Sign in</Text>
							</Button>
						</CardContent>
					</Card>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["top", "left", "right", "bottom"]}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<View style={styles.header}>
					<View style={styles.headerTopRow}>
						<TouchableOpacity
							onPress={() => router.back()}
							style={styles.backButton}
						>
							<ArrowLeft size={24} color={colors.onBackground} />
						</TouchableOpacity>
						<Text style={[styles.headerTitle, { color: colors.onBackground }]}>
							Friends
						</Text>
					</View>
					<View
						style={[
							styles.headerPanel,
							{
								backgroundColor: colors.surfaceContainerHigh,
								borderColor: colors.outlineVariant,
							},
						]}
					>
						<Users size={24} color={colors.primary} />
						<View style={styles.headerCopy}>
							<Text style={[styles.title, { color: colors.onSurface }]}>
								Manage your circle
							</Text>
							<Text
								style={[styles.subtitle, { color: colors.onSurfaceVariant }]}
							>
								Search OpnShelf friends, keep tabs on who follows you, and
								manage who you follow.
							</Text>
						</View>
					</View>
				</View>

				<SearchInput
					value={query}
					onChangeText={setQuery}
					onClear={() => setQuery("")}
					placeholder="Search friends"
					containerStyle={styles.searchInput}
				/>

				{hasSearch ? (
					<FriendsSearchResultsSection
						hasResolved={Boolean(searchQuery.data || searchQuery.isFetched)}
						hasNextPage={searchQuery.hasNextPage}
						isFetching={searchQuery.isFetching}
						isFetchingNextPage={searchQuery.isFetchingNextPage}
						onLoadMore={() => void searchQuery.fetchNextPage()}
						query={debouncedQuery}
						results={searchResults}
						viewerHandle={user.handle}
					/>
				) : (
					<Card
						style={{
							...styles.stateCard,
							backgroundColor: colors.surfaceContainerHigh,
							borderColor: colors.outlineVariant,
						}}
					>
						<CardHeader>
							<Text style={[styles.stateTitle, { color: colors.onSurface }]}>
								Find friends on OpnShelf
							</Text>
							<Text
								style={[
									styles.stateDescription,
									{ color: colors.onSurfaceVariant },
								]}
							>
								Type at least two characters to search handles and display
								names.
							</Text>
						</CardHeader>
					</Card>
				)}

				<FriendsTabs
					activeTab={activeTab}
					counts={{
						following: profileQuery.data?.followingCount ?? 0,
						followers: profileQuery.data?.followersCount ?? 0,
					}}
					onChange={setActiveTab}
				/>

				<SocialConnectionsSection
					emptyDescription={
						activeTab === "following"
							? "You are not following anyone on OpnShelf yet."
							: "Nobody is following you on OpnShelf yet."
					}
					emptyTitle={
						activeTab === "following"
							? "Not following anyone yet"
							: "No followers yet"
					}
					hasNextPage={
						activeTab === "following"
							? followingQuery.hasNextPage
							: followersQuery.hasNextPage
					}
					isFetchingNextPage={
						activeTab === "following"
							? followingQuery.isFetchingNextPage
							: followersQuery.isFetchingNextPage
					}
					isLoading={
						activeTab === "following"
							? followingQuery.isLoading
							: followersQuery.isLoading
					}
					items={activeTab === "following" ? followingItems : followerItems}
					onLoadMore={() => {
						if (activeTab === "following") {
							void followingQuery.fetchNextPage();
							return;
						}

						void followersQuery.fetchNextPage();
					}}
					viewerHandle={user.handle}
				/>
			</ScrollView>
		</SafeAreaView>
	);
}

function getFriendsTab(
	value: string | FriendsTab | undefined,
): FriendsTab | null {
	if (value === "following" || value === "followers") {
		return value;
	}

	return null;
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		padding: spacing.lg,
		gap: spacing.lg,
	},
	header: {
		gap: spacing.md,
	},
	headerTopRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
	},
	backButton: {
		padding: spacing.sm,
	},
	headerTitle: {
		fontSize: 28,
		fontWeight: "700",
	},
	headerPanel: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: spacing.md,
		borderWidth: 1,
		borderRadius: borderRadius.xl,
		padding: spacing.md,
	},
	headerCopy: {
		flex: 1,
		gap: spacing.xs,
	},
	title: {
		fontSize: 22,
		fontWeight: "700",
	},
	subtitle: {
		fontSize: 14,
		lineHeight: 21,
	},
	searchInput: {
		marginTop: spacing.xs,
	},
	centerContent: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: spacing.xl,
	},
	stateCard: {
		borderWidth: 1,
		borderRadius: borderRadius.xl,
	},
	stateTitle: {
		fontSize: 22,
		fontWeight: "700",
	},
	stateDescription: {
		fontSize: 15,
		lineHeight: 22,
	},
});
