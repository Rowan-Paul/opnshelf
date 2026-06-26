import { socialControllerSearchPeopleOptions } from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { ChevronRight, Plus, Search, Users, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserRow } from "@/components/social/UserRow";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth-context";
import { useCircles, useCreateCircle } from "@/lib/use-circles";
import { useDebounce } from "@/lib/use-debounce";
import { useFollowToggle } from "@/lib/use-social";

/**
 * Connections: grow & organise your network. People search (to follow) plus your
 * Circles (create + drill into a Circle detail). Following/Followers live on the
 * Profile (reached from its counts), not here.
 */
export default function ConnectionsScreen() {
	const insets = useSafeAreaInsets();
	const { user } = useAuth();
	const myDid = user?.did ?? "";

	const [query, setQuery] = useState("");
	const debouncedQuery = useDebounce(query.trim(), 350);
	const hasQuery = debouncedQuery.length > 0;

	const { toggle } = useFollowToggle();
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
			<View className="px-4 pt-3 pb-3">
				<Text className="font-bold font-display text-2xl text-foreground">
					Connections
				</Text>
				<Text className="text-muted-foreground text-sm">
					Find people to follow and organise them into circles
				</Text>
			</View>

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
					placeholder="Find people to follow…"
					autoCapitalize="none"
					autoCorrect={false}
					returnKeyType="search"
				/>
			</View>

			{hasQuery ? (
				peopleQuery.isLoading ? (
					<LoadingState label="Searching…" />
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
			) : (
				<ScrollView contentContainerClassName="px-4 pb-8 gap-2">
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
