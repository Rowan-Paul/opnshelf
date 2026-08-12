import {
	type SocialUserCardDto,
	socialControllerSearchPeopleOptions,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link } from "expo-router";
import {
	ChevronRight,
	Plus,
	Search,
	Sparkles,
	User,
	Users,
	X,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserRow } from "@/components/social/UserRow";
import { TourAnchor } from "@/components/tour/WelcomeTour";
import { UserRowsSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth-context";
import { useCircles, useCreateCircle } from "@/lib/use-circles";
import { useDebounce } from "@/lib/use-debounce";
import {
	useFollowers,
	useFollowing,
	useFollowToggle,
	useSuggestions,
} from "@/lib/use-social";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Connections: grow & organise your network. People search (to follow), recent
 * following/followers previews, and your Circles (create + drill into a Circle
 * detail). The full Following/Followers lists live on the Profile.
 */
export default function ConnectionsScreen() {
	const insets = useSafeAreaInsets();
	const { user } = useAuth();
	const myDid = user?.did ?? "";
	const handle = user?.handle ?? "";

	const [query, setQuery] = useState("");
	const [isSearchFocused, setIsSearchFocused] = useState(false);
	const debouncedQuery = useDebounce(query.trim(), 350);
	const hasQuery = debouncedQuery.length > 0;
	const hasInput = query.trim().length > 0;

	const { toggle } = useFollowToggle();
	const following = useFollowing(handle);
	const recentFollowing = following.items.slice(0, 12);
	const followers = useFollowers(handle);
	const recentFollowers = followers.items.slice(0, 12);
	const suggestionsQuery = useSuggestions(isSearchFocused && !hasQuery);
	const suggestions = suggestionsQuery.data?.items ?? [];
	const { data: circles = [] } = useCircles();
	const createCircle = useCreateCircle();
	const [newName, setNewName] = useState("");

	const peopleQuery = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedQuery, pageSize: 20 },
		}),
		enabled: hasQuery,
	});
	const results = peopleQuery.data?.items ?? [];

	const handleCreate = () => {
		const name = newName.trim();
		if (!name) return;
		createCircle.mutate(
			{ body: { name } },
			{ onSuccess: () => setNewName("") },
		);
	};

	return (
		<View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
			<TourAnchor id="connections" className="px-4 pt-3 pb-3">
				<Text className="font-bold font-display text-2xl text-foreground">
					Connections
				</Text>
				<Text className="text-muted-foreground text-sm">
					Find people to follow and organise them into circles
				</Text>
			</TourAnchor>

			<View className="px-4 pb-3">
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
					placeholder="Find new people to follow"
					autoCapitalize="none"
					autoCorrect={false}
					returnKeyType="search"
					onFocus={() => setIsSearchFocused(true)}
					onBlur={() => setIsSearchFocused(false)}
				/>
			</View>

			{hasInput ? (
				!hasQuery || peopleQuery.isLoading ? (
					<View className="px-4">
						<UserRowsSkeleton />
					</View>
				) : results.length === 0 ? (
					<EmptyState
						icon={Users}
						title="No people found"
						message={`No users match “${debouncedQuery}”.`}
					/>
				) : (
					<FlashList
						data={results}
						keyExtractor={(item) => item.did}
						renderItem={({ item }) => (
							<View className="px-4 pb-2">
								<UserRow
									user={item}
									isSelf={item.did === myDid}
									onToggleFollow={toggle}
								/>
							</View>
						)}
						keyboardShouldPersistTaps="handled"
					/>
				)
			) : isSearchFocused ? (
				<View className="px-4">
					<View className="flex-row items-center gap-2 pb-3">
						<Sparkles color="#94a3b8" size={18} />
						<Text className="font-display font-semibold text-base text-foreground">
							Recommended for you
						</Text>
					</View>
					{suggestionsQuery.isLoading ? (
						<UserRowsSkeleton />
					) : suggestions.length === 0 ? (
						<Text className="py-4 text-center text-muted-foreground text-sm">
							No recommendations right now.
						</Text>
					) : (
						<View className="gap-2">
							{suggestions.map((person) => (
								<UserRow
									key={person.did}
									user={person}
									isSelf={person.did === myDid}
									onToggleFollow={toggle}
								/>
							))}
						</View>
					)}
				</View>
			) : (
				<ScrollView contentContainerClassName="px-4 pb-8 gap-2">
					{handle ? (
						<FollowPreview
							title="Recent following"
							handle={handle}
							tab="following"
							items={recentFollowing}
						/>
					) : null}
					{handle ? (
						<FollowPreview
							title="Recent followers"
							handle={handle}
							tab="followers"
							items={recentFollowers}
						/>
					) : null}

					<View className="flex-row items-center gap-2 pb-1">
						<Users color="#94a3b8" size={18} />
						<Text className="font-display font-semibold text-base text-foreground">
							Circles
						</Text>
					</View>

					<View className="flex-row items-center gap-2 pb-2">
						<View className="flex-1">
							<TextField
								value={newName}
								onChangeText={setNewName}
								placeholder="New circle name"
								maxLength={50}
								returnKeyType="done"
								onSubmitEditing={handleCreate}
							/>
						</View>
						<Pressable
							onPress={handleCreate}
							disabled={!newName.trim() || createCircle.isPending}
							className="size-11 items-center justify-center rounded-lg bg-primary"
							style={{
								opacity: !newName.trim() || createCircle.isPending ? 0.5 : 1,
							}}
						>
							<Plus color="#3f2e00" size={20} strokeWidth={3} />
						</Pressable>
					</View>

					{circles.length === 0 ? (
						<Text className="py-4 text-center text-muted-foreground text-sm">
							No circles yet. Create one above, then add people to it.
						</Text>
					) : (
						circles.map((circle) => (
							<Link
								key={circle.id}
								href={`/circles/${circle.id}` as const}
								asChild
							>
								<Pressable className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-4">
									<View className="min-w-0 flex-1">
										<Text
											className="font-medium text-foreground"
											numberOfLines={1}
										>
											{circle.name}
										</Text>
										<Text className="text-muted-foreground text-xs">
											{circle.memberCount}{" "}
											{circle.memberCount === 1 ? "person" : "people"}
										</Text>
									</View>
									<ChevronRight color="#94a3b8" size={18} />
								</Pressable>
							</Link>
						))
					)}
				</ScrollView>
			)}
		</View>
	);
}

/** Horizontal avatar preview row linking to the full list on the profile. */
function FollowPreview({
	title,
	handle,
	tab,
	items,
}: {
	title: string;
	handle: string;
	tab: "following" | "followers";
	items: SocialUserCardDto[];
}) {
	const avatarStyle = useTwStyle("size-12");
	if (items.length === 0) return null;
	return (
		<View className="gap-2 pb-4">
			<View className="flex-row items-center justify-between">
				<Text className="font-display font-semibold text-base text-foreground">
					{title}
				</Text>
				<Link
					href={`/profile/${handle}/connections?tab=${tab}` as const}
					asChild
				>
					<Pressable hitSlop={8}>
						<Text className="font-medium text-primary text-sm">See all</Text>
					</Pressable>
				</Link>
			</View>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerClassName="gap-4"
			>
				{items.map((person) => {
					const avatar =
						typeof person.avatar === "string" ? person.avatar : undefined;
					const name =
						(typeof person.displayName === "string"
							? person.displayName
							: undefined) || person.handle;
					return (
						<Link
							key={person.did}
							href={`/profile/${person.handle}` as const}
							asChild
						>
							<Pressable className="w-16 items-center gap-1">
								<View className="size-12 items-center justify-center overflow-hidden rounded-full bg-background-subtle">
									{avatar ? (
										<Image
											source={{ uri: avatar }}
											style={avatarStyle}
											contentFit="cover"
										/>
									) : (
										<User color="#94a3b8" size={20} />
									)}
								</View>
								<Text
									className="text-center text-muted-foreground text-xs"
									numberOfLines={1}
								>
									{name}
								</Text>
							</Pressable>
						</Link>
					);
				})}
			</ScrollView>
		</View>
	);
}
