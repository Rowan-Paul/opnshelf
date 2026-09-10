import {
	type SocialUserCardDto,
	socialControllerSearchPeopleOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link, Stack } from "expo-router";
import { Search, Sparkles, Users, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { UserRow } from "@/components/social/UserRow";
import { UserRowsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth-context";
import { useDebounce } from "@/lib/use-debounce";
import { useFollowToggle, useSuggestions } from "@/lib/use-social";

/** Search and recommendations live under Social so the feed remains the tab. */
export default function FindPeopleScreen() {
	const { user } = useAuth();
	const { toggle } = useFollowToggle();
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
	const people: SocialUserCardDto[] = hasQuery
		? (searchQuery.data?.items ?? [])
		: (suggestionsQuery.data?.items ?? []);
	const isLoading = hasQuery
		? searchQuery.isLoading
		: suggestionsQuery.isLoading;
	const isError = hasQuery ? searchQuery.isError : suggestionsQuery.isError;
	const retry = hasQuery ? searchQuery.refetch : suggestionsQuery.refetch;

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ headerShown: true, title: "Find people" }} />
			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerClassName="gap-4 px-4 py-4 pb-8"
			>
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

				<View className="flex-row gap-2">
					<ProfileListLink
						handle={user?.handle}
						tab="following"
						label="Following"
					/>
					<ProfileListLink
						handle={user?.handle}
						tab="followers"
						label="Followers"
					/>
				</View>

				<View className="flex-row items-center gap-2">
					{hasQuery ? (
						<Search color="#94a3b8" size={18} />
					) : (
						<Sparkles color="#94a3b8" size={18} />
					)}
					<Text className="font-display font-semibold text-base text-foreground">
						{hasQuery ? "Search results" : "Suggested people"}
					</Text>
				</View>

				{isLoading ? (
					<UserRowsSkeleton />
				) : isError && people.length === 0 ? (
					<ErrorState
						message={
							hasQuery
								? "Couldn't search people."
								: "Couldn't load suggestions."
						}
						onRetry={() => void retry()}
					/>
				) : people.length === 0 ? (
					<EmptyState
						icon={Users}
						title={hasQuery ? "No people found" : "No suggestions right now"}
						message={
							hasQuery ? `No users match “${debouncedQuery}”.` : undefined
						}
					/>
				) : (
					<View className="gap-2">
						{people.map((person) => (
							<UserRow
								key={person.did}
								user={person}
								isSelf={person.did === user?.did}
								onToggleFollow={toggle}
							/>
						))}
					</View>
				)}
			</ScrollView>
		</View>
	);
}

function ProfileListLink({
	handle,
	tab,
	label,
}: {
	handle?: string;
	tab: "following" | "followers";
	label: string;
}) {
	if (!handle) return null;
	return (
		<Link href={`/profile/${handle}/connections?tab=${tab}` as const} asChild>
			<Pressable className="flex-1 rounded-lg border border-border bg-card px-3 py-2.5">
				<Text className="text-center font-semibold text-foreground text-sm">
					{label}
				</Text>
			</Pressable>
		</Link>
	);
}
