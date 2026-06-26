import {
	type SocialUserCardDto,
	socialControllerSearchPeopleOptions,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { Search, Users, UserX, X } from "lucide-react-native";
import { useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	View,
} from "react-native";
import { AddToCircleSheet } from "@/components/social/AddToCircleSheet";
import { UserRow } from "@/components/social/UserRow";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";
import {
	useAddCircleMember,
	useCircles,
	useRemoveCircleMember,
} from "@/lib/use-circles";
import { useDebounce } from "@/lib/use-debounce";
import { useFollowers, useFollowing, useFollowToggle } from "@/lib/use-social";
import { useTwStyle } from "@/lib/use-tw-style";

type Tab = "following" | "followers";

export default function FriendsScreen() {
	const { user } = useAuth();
	const handle = user?.handle ?? "";
	const myDid = user?.did ?? "";

	const [tab, setTab] = useState<Tab>("following");
	const [query, setQuery] = useState("");
	const [refreshing, setRefreshing] = useState(false);
	const debouncedQuery = useDebounce(query.trim(), 350);
	const hasQuery = debouncedQuery.length > 0;

	const listStyle = useTwStyle("px-4 pb-8");
	const queryClient = useQueryClient();

	const following = useFollowing(handle);
	const followers = useFollowers(handle);
	const { toggle } = useFollowToggle();

	// Circle membership management (following tab only).
	const { data: circles = [] } = useCircles();
	const addMember = useAddCircleMember();
	const removeMember = useRemoveCircleMember();
	const [circleUserDid, setCircleUserDid] = useState<string | null>(null);
	const circleUser =
		following.items.find((u) => u.did === circleUserDid) ?? null;

	const peopleQuery = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedQuery, pageSize: 20 },
		}),
		enabled: hasQuery,
	});

	const active = tab === "following" ? following : followers;
	const searchResults = peopleQuery.data?.items ?? [];

	// The following/followers infinite lists come from hooks that don't surface a
	// refetch, so on pull we refetch the people search (when searching) and
	// invalidate the active social list via the query client.
	const onRefresh = async () => {
		setRefreshing(true);
		try {
			if (hasQuery) {
				await peopleQuery.refetch();
			} else {
				const id =
					tab === "following"
						? "socialControllerGetFollowing"
						: "socialControllerGetFollowers";
				await queryClient.refetchQueries({
					predicate: (q) => {
						const key = q.queryKey[0] as { _id?: string } | undefined;
						return key?._id === id;
					},
				});
			}
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

	const renderRow = (item: SocialUserCardDto, showCircle = false) => (
		<View className="pb-2">
			<UserRow
				user={item}
				isSelf={item.did === myDid}
				onToggleFollow={toggle}
				onAddToCircle={showCircle ? (u) => setCircleUserDid(u.did) : undefined}
			/>
		</View>
	);

	function renderBody() {
		if (hasQuery) {
			if (peopleQuery.isLoading) return <LoadingState label="Searching…" />;
			if (peopleQuery.isError) {
				return <ErrorState message="Couldn't search people. Try again." />;
			}
			if (searchResults.length === 0) {
				return (
					<EmptyState
						icon={Users}
						title="No people found"
						message={`No users match “${debouncedQuery}”.`}
					/>
				);
			}
			return (
				<FlashList
					data={searchResults}
					keyExtractor={(item) => item.did}
					renderItem={({ item }) => renderRow(item)}
					contentContainerStyle={listStyle}
					keyboardShouldPersistTaps="handled"
					refreshControl={refreshControl}
				/>
			);
		}

		if (active.isLoading) return <LoadingState />;
		if (active.isError) {
			return <ErrorState message="Couldn't load this list. Try again." />;
		}
		if (active.items.length === 0) {
			return (
				<EmptyState
					icon={UserX}
					title={tab === "following" ? "Not following anyone" : "No followers"}
					message={
						tab === "following"
							? "Search above to find people to follow."
							: "When people follow you, they'll show up here."
					}
				/>
			);
		}
		return (
			<FlashList
				data={active.items}
				keyExtractor={(item) => item.did}
				renderItem={({ item }) => renderRow(item, tab === "following")}
				contentContainerStyle={listStyle}
				keyboardShouldPersistTaps="handled"
				refreshControl={refreshControl}
				onEndReachedThreshold={0.5}
				onEndReached={() => {
					if (active.hasNextPage && !active.isFetchingNextPage) {
						active.fetchNextPage();
					}
				}}
				ListFooterComponent={
					active.isFetchingNextPage ? (
						<View className="py-6">
							<ActivityIndicator color="#94a3b8" />
						</View>
					) : null
				}
			/>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ headerShown: true, title: "Connections" }} />

			<View className="px-4 pt-3 pb-3">
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
					placeholder="Find people to follow…"
					autoCapitalize="none"
					autoCorrect={false}
					returnKeyType="search"
				/>

				{hasQuery ? null : (
					<View className="mt-3 flex-row gap-2">
						{(["following", "followers"] as const).map((key) => {
							const isActive = tab === key;
							return (
								<Pressable
									key={key}
									onPress={() => setTab(key)}
									className={cn(
										"rounded-full px-3 py-1.5",
										isActive ? "bg-primary" : "bg-background-subtle",
									)}
								>
									<Text
										className={cn(
											"font-medium text-sm capitalize",
											isActive
												? "text-primary-foreground"
												: "text-muted-foreground",
										)}
									>
										{key}
									</Text>
								</Pressable>
							);
						})}
					</View>
				)}
			</View>

			<View className="flex-1">{renderBody()}</View>

			<AddToCircleSheet
				visible={circleUser !== null}
				onDismiss={() => setCircleUserDid(null)}
				circles={circles}
				memberOf={circleUser?.circleIds ?? []}
				onToggle={(circleId, isMember) => {
					if (!circleUserDid) return;
					const path = { circleId, targetDid: circleUserDid };
					if (isMember) {
						removeMember.mutate({ path });
					} else {
						addMember.mutate({ path });
					}
				}}
			/>
		</View>
	);
}
