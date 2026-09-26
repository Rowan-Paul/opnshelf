import { socialControllerSearchPeopleInfiniteOptions } from "@opnshelf/api";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { UserRow } from "@/components/social/UserRow";
import { Button } from "@/components/ui/button";
import { UserRowsSkeleton } from "@/components/ui/skeletons";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth-context";
import { useDebounce } from "@/lib/use-debounce";
import { useFollowToggle, useSuggestions } from "@/lib/use-social";

export function SuggestionsStep({ onFollowed }: { onFollowed: () => void }) {
	const { user } = useAuth();
	const [query, setQuery] = useState("");
	const trimmedQuery = query.trim();
	const debouncedQuery = useDebounce(trimmedQuery, 350);
	const hasQuery = trimmedQuery.length > 0;
	const search = useInfiniteQuery({
		...socialControllerSearchPeopleInfiniteOptions({
			query: { q: debouncedQuery, pageSize: 20 },
		}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
		enabled: hasQuery && debouncedQuery.length > 0,
		placeholderData: keepPreviousData,
	});
	const suggested = useSuggestions(!hasQuery);
	const people = hasQuery
		? (search.data?.pages.flatMap((page) => page.items) ?? [])
		: (suggested.data?.items ?? []);
	const isLoading = hasQuery
		? search.isLoading ||
			(trimmedQuery !== debouncedQuery && people.length === 0)
		: suggested.isLoading;
	const error = hasQuery ? search.error : suggested.error;
	const retry = hasQuery ? search.refetch : suggested.refetch;
	const { toggle } = useFollowToggle(onFollowed);

	return (
		<>
			<View className="gap-1">
				<Text className="font-bold font-display text-3xl text-foreground">
					People to follow
				</Text>
				<Text className="text-muted-foreground text-sm">
					Find people you know on Opnshelf.
				</Text>
			</View>

			<TextField
				accessibilityLabel="Search people"
				placeholder="Search people"
				value={query}
				onChangeText={setQuery}
				autoCapitalize="none"
				autoCorrect={false}
				returnKeyType="search"
				trailing={
					query.length > 0 ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Clear search"
							hitSlop={8}
							onPress={() => setQuery("")}
						>
							<Text className="text-primary">Clear</Text>
						</Pressable>
					) : undefined
				}
			/>
			{error && (
				<View className="gap-2">
					<Text accessibilityRole="alert">
						{hasQuery
							? "Couldn't search people."
							: "Couldn't load suggestions."}
					</Text>
					<Button
						label="Try again"
						variant="secondary"
						onPress={() => void retry()}
					/>
				</View>
			)}

			{isLoading && people.length === 0 ? (
				<UserRowsSkeleton />
			) : people.length === 0 ? (
				!error && (
					<Text className="py-8 text-center text-muted-foreground text-sm">
						{hasQuery
							? "No people found. Try another name or handle."
							: "No suggestions right now."}
					</Text>
				)
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
			{hasQuery && search.isFetchingNextPage && <UserRowsSkeleton />}
			{hasQuery && search.hasNextPage && (
				<Button
					label={
						search.isFetchNextPageError ? "Retry loading more" : "Load more"
					}
					variant="secondary"
					disabled={
						search.isFetching ||
						search.isPlaceholderData ||
						trimmedQuery !== debouncedQuery
					}
					onPress={() => void search.fetchNextPage()}
				/>
			)}
		</>
	);
}
