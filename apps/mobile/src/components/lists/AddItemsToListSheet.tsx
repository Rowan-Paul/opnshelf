import {
	searchControllerSearchAllOptions,
	type UnifiedSearchResultDto,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Search, SearchX, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { posthog } from "@/lib/posthog";
import { posterUrl, yearFromDate } from "@/lib/tmdb";
import { useDebounce } from "@/lib/use-debounce";
import { useAddListItem, useRemoveListItem } from "@/lib/use-lists";

// Ponytail ceiling: v1 adds whole movies/shows only — no season/episode scoping.
// The search endpoint only returns movie/tv results, and the add mutation is
// called with the bare media type. If per-season/episode adds are ever needed,
// that's a follow-up (extra pickers + season/episode args on the mutation).
type Addable = "movie" | "show";

const itemKey = (mediaType: Addable, mediaId: string) =>
	`${mediaType}:${mediaId}`;

function resultKey(r: UnifiedSearchResultDto) {
	return itemKey(r.media_type === "movie" ? "movie" : "show", String(r.id));
}

/**
 * Bottom sheet for adding movies/shows to the current list via a debounced
 * search (same `searchControllerSearchAll` query the Discover tab uses).
 * Results are compact rows with an add/added toggle wired to the per-slug
 * add/remove list-item mutations, which invalidate the list query so the grid
 * behind the sheet updates on change.
 *
 * `existingKeys` seeds the "added" state from the items already loaded on the
 * detail screen so those show as added immediately; the sheet then tracks its
 * own optimistic toggles on top.
 */
export function AddItemsToListSheet({
	visible,
	onDismiss,
	slug,
	existingKeys,
}: {
	visible: boolean;
	onDismiss: () => void;
	slug: string;
	existingKeys: Set<string>;
}) {
	const [query, setQuery] = useState("");
	const debouncedQuery = useDebounce(query.trim(), 350);
	const hasQuery = debouncedQuery.length > 0;

	// Optimistic per-session overrides layered on top of `existingKeys`.
	const [added, setAdded] = useState<Set<string>>(new Set());
	const [removed, setRemoved] = useState<Set<string>>(new Set());

	const addItem = useAddListItem(slug);
	const removeItem = useRemoveListItem(slug);

	const searchQuery = useQuery({
		...searchControllerSearchAllOptions({ query: { query: debouncedQuery } }),
		enabled: visible && hasQuery,
	});

	useEffect(() => {
		if (!visible || !hasQuery || !searchQuery.data) return;
		posthog?.capture("search_performed", {
			surface: "list_item_picker",
			tab: "all",
			query_length: debouncedQuery.length,
			result_count: searchQuery.data.results?.length ?? 0,
		});
	}, [debouncedQuery.length, hasQuery, searchQuery.data, visible]);

	const results = useMemo(
		() => searchQuery.data?.results ?? [],
		[searchQuery.data],
	);

	const isAdded = (key: string) =>
		added.has(key) || (existingKeys.has(key) && !removed.has(key));

	const toggle = (r: UnifiedSearchResultDto) => {
		const mediaType: Addable = r.media_type === "movie" ? "movie" : "show";
		const mediaId = String(r.id);
		const key = itemKey(mediaType, mediaId);
		if (isAdded(key)) {
			setAdded((s) => {
				const next = new Set(s);
				next.delete(key);
				return next;
			});
			setRemoved((s) => new Set(s).add(key));
			removeItem.mutate({ path: { slug, mediaType, mediaId }, query: {} });
		} else {
			setRemoved((s) => {
				const next = new Set(s);
				next.delete(key);
				return next;
			});
			setAdded((s) => new Set(s).add(key));
			addItem.mutate({ path: { slug }, body: { mediaType, mediaId } });
		}
	};

	const handleDismiss = () => {
		setQuery("");
		setAdded(new Set());
		setRemoved(new Set());
		onDismiss();
	};

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={handleDismiss}
		>
			<View className="flex-1 justify-end">
				<Pressable className="flex-1" onPress={handleDismiss} />
				<View className="h-[80%] gap-3 rounded-t-2xl border border-border bg-card p-5">
					<View className="flex-row items-center justify-between">
						<Text className="font-bold font-display text-foreground text-lg">
							Add items
						</Text>
						<Pressable hitSlop={8} onPress={handleDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
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
						placeholder="Search movies & shows…"
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="search"
					/>

					<View className="flex-1">
						{!hasQuery ? (
							<Text className="py-4 text-muted-foreground text-sm">
								Search for a movie or show to add it to this list.
							</Text>
						) : searchQuery.isLoading ? (
							<View className="gap-1">
								{Array.from({ length: 4 }, (_, i) => i).map((i) => (
									<View key={i} className="flex-row items-center gap-3 py-2">
										<View className="h-16 w-11 rounded-md bg-background-subtle" />
										<View className="min-w-0 flex-1 gap-2">
											<View className="h-3.5 w-3/5 rounded bg-background-subtle" />
											<View className="h-2.5 w-1/4 rounded bg-background-subtle" />
										</View>
										<View className="size-8 rounded-full bg-background-subtle" />
									</View>
								))}
							</View>
						) : results.length === 0 ? (
							<View className="items-center py-8">
								<SearchX color="#94a3b8" size={28} />
								<Text className="mt-2 text-muted-foreground text-sm">
									Nothing matched “{debouncedQuery}”.
								</Text>
							</View>
						) : (
							<FlashList
								data={results}
								keyExtractor={(r) => resultKey(r)}
								keyboardShouldPersistTaps="handled"
								showsVerticalScrollIndicator={false}
								renderItem={({ item }) => (
									<SearchResultRow
										result={item}
										added={isAdded(resultKey(item))}
										onToggle={() => toggle(item)}
									/>
								)}
							/>
						)}
					</View>
				</View>
			</View>
		</Modal>
	);
}

function SearchResultRow({
	result,
	added,
	onToggle,
}: {
	result: UnifiedSearchResultDto;
	added: boolean;
	onToggle: () => void;
}) {
	const isMovie = result.media_type === "movie";
	const title = result.title || result.name || "Untitled";
	const year = yearFromDate(
		isMovie ? result.release_date : result.first_air_date,
	);
	return (
		<View className="flex-row items-center gap-3 py-2">
			<View className="h-16 w-11 overflow-hidden rounded-md">
				<PosterImage
					url={posterUrl(result.poster_path, "w185")}
					className="h-16 w-11"
				/>
			</View>
			<View className="min-w-0 flex-1">
				<Text className="font-medium text-foreground text-sm" numberOfLines={2}>
					{title}
				</Text>
				<Text className="text-muted-foreground text-xs">
					{isMovie ? "Movie" : "Show"}
					{year ? ` · ${year}` : ""}
				</Text>
			</View>
			<Pressable
				hitSlop={8}
				onPress={onToggle}
				className={cn(
					"size-8 items-center justify-center rounded-full",
					added ? "bg-primary" : "bg-background-subtle",
				)}
			>
				{added ? (
					<Check color="#3f2e00" size={18} strokeWidth={3} />
				) : (
					<Plus color="#94a3b8" size={18} strokeWidth={2.5} />
				)}
			</Pressable>
		</View>
	);
}
