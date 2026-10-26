import {
	moviesControllerGetMovieDetailsOptions,
	searchControllerSearchAllOptions,
	showsControllerGetShowDetailsOptions,
	type UnifiedSearchResultDto,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Search, SearchX, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { parseWatchlistInput } from "@/lib/app-shortcut-input";
import { cn } from "@/lib/cn";
import { posthog } from "@/lib/posthog";
import { posterUrl, yearFromDate } from "@/lib/tmdb";
import { useDebounce } from "@/lib/use-debounce";
import { useAddListItem, useRemoveListItem } from "@/lib/use-lists";
import { useThemeColors } from "@/theme/colors";

// Ponytail ceiling: v1 adds whole movies/shows only — no season/episode scoping.
// The search endpoint only returns movie/tv results, and the add mutation is
// called with the bare media type. If per-season/episode adds are ever needed,
// that's a follow-up (extra pickers + season/episode args on the mutation).
type SearchResult = Pick<
	UnifiedSearchResultDto,
	| "id"
	| "media_type"
	| "title"
	| "name"
	| "poster_path"
	| "release_date"
	| "first_air_date"
>;
type Addable = "movie" | "show";

const itemKey = (mediaType: Addable, mediaId: string) =>
	`${mediaType}:${mediaId}`;

function resultKey(r: SearchResult) {
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
	initialInput,
	confirmBeforeAdd = false,
}: {
	visible: boolean;
	onDismiss: () => void;
	slug: string;
	existingKeys: Set<string>;
	initialInput?: string;
	confirmBeforeAdd?: boolean;
}) {
	const colors = useThemeColors();
	const input = initialInput ? parseWatchlistInput(initialInput) : null;
	const [target, setTarget] = useState(
		input && "mediaId" in input ? input : null,
	);
	const [query, setQuery] = useState(
		input && "query" in input ? input.query : "",
	);
	const adding = useRef(false);
	const [confirming, setConfirming] = useState<SearchResult | null>(null);
	const debouncedQuery = useDebounce(query.trim(), 350);
	const hasQuery = debouncedQuery.length > 0;

	// Optimistic per-session overrides layered on top of `existingKeys`.
	const [added, setAdded] = useState<Set<string>>(new Set());
	const [removed, setRemoved] = useState<Set<string>>(new Set());

	const addItem = useAddListItem(slug);
	const removeItem = useRemoveListItem(slug);

	const searchQuery = useQuery({
		...searchControllerSearchAllOptions({ query: { query: debouncedQuery } }),
		enabled: visible && hasQuery && !target,
	});

	const movie = useQuery({
		...moviesControllerGetMovieDetailsOptions({
			path: { movieId: target?.mediaId ?? "" },
		}),
		enabled: visible && target?.mediaType === "movie",
	});
	const show = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId: target?.mediaId ?? "" },
		}),
		enabled: visible && target?.mediaType === "show",
	});
	const linkedQuery = target?.mediaType === "movie" ? movie : show;
	const linkedResult: SearchResult | undefined =
		movie.data && target?.mediaType === "movie"
			? {
					id: Number(target.mediaId),
					media_type: "movie",
					title: movie.data.title,
					poster_path: movie.data.poster_path,
					release_date: movie.data.release_date,
				}
			: show.data && target?.mediaType === "show"
				? {
						id: Number(target.mediaId),
						media_type: "tv",
						name: show.data.name,
						poster_path: show.data.poster_path,
						first_air_date: show.data.first_air_date,
					}
				: undefined;

	useEffect(() => {
		if (!visible || !hasQuery || !searchQuery.data) return;
		posthog?.capture("search_performed", {
			surface: "list_item_picker",
			tab: "all",
			query_length: debouncedQuery.length,
			result_count: searchQuery.data.items?.length ?? 0,
		});
	}, [debouncedQuery.length, hasQuery, searchQuery.data, visible]);

	const results: SearchResult[] = target
		? linkedResult
			? [linkedResult]
			: []
		: (searchQuery.data?.items ?? []);

	const isAdded = (key: string) =>
		added.has(key) || (existingKeys.has(key) && !removed.has(key));

	const toggle = (r: SearchResult) => {
		if (confirmBeforeAdd) {
			if (!isAdded(resultKey(r))) setConfirming(r);
			return;
		}
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
		setConfirming(null);
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
						<Text className="font-display-bold text-foreground text-lg">
							Add items
						</Text>
						<Pressable hitSlop={8} onPress={handleDismiss}>
							<X color={colors.mutedForeground} size={22} />
						</Pressable>
					</View>

					<TextField
						leading={<Search color={colors.mutedForeground} size={18} />}
						trailing={
							query.length > 0 ? (
								<Pressable hitSlop={8} onPress={() => setQuery("")}>
									<X color={colors.mutedForeground} size={18} />
								</Pressable>
							) : null
						}
						value={query}
						onChangeText={(value) => {
							setTarget(null);
							setConfirming(null);
							setQuery(value);
						}}
						placeholder="Search movies & shows…"
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="search"
					/>

					<View className="flex-1">
						{confirming ? (
							<View className="gap-4 py-4">
								<Text className="font-semibold text-lg">Add to Watchlist?</Text>
								<Text>
									{confirming.title || confirming.name} ·{" "}
									{confirming.media_type === "movie" ? "Movie" : "Show"} ·{" "}
									{yearFromDate(
										confirming.release_date || confirming.first_air_date,
									)}
								</Text>
								<Button
									label={addItem.isPending ? "Adding…" : "Add to Watchlist"}
									disabled={addItem.isPending}
									onPress={() => {
										if (addItem.isPending || adding.current) return;
										adding.current = true;
										const selected = confirming;
										addItem.mutate(
											{
												path: { slug },
												body: {
													mediaType:
														selected.media_type === "movie" ? "movie" : "show",
													mediaId: String(selected.id),
												},
											},
											{
												onSettled: () => {
													adding.current = false;
												},
												onSuccess: () => {
													setAdded((current) =>
														new Set(current).add(resultKey(selected)),
													);
													setConfirming(null);
												},
											},
										);
									}}
								/>
								<Button
									label="Cancel"
									variant="secondary"
									disabled={addItem.isPending}
									onPress={() => setConfirming(null)}
								/>
							</View>
						) : (target ? linkedQuery.isError : searchQuery.isError) ? (
							<ErrorState
								message="Couldn't load these titles."
								onRetry={() => {
									void (target ? linkedQuery : searchQuery).refetch();
								}}
							/>
						) : !hasQuery && !target ? (
							<Text className="py-4 text-muted-foreground text-sm">
								Search for a movie or show to add it to this list.
							</Text>
						) : (target ? linkedQuery.isLoading : searchQuery.isLoading) ? (
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
								<SearchX color={colors.mutedForeground} size={28} />
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
										disabled={confirmBeforeAdd && isAdded(resultKey(item))}
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
	disabled,
}: {
	result: SearchResult;
	added: boolean;
	onToggle: () => void;
	disabled?: boolean;
}) {
	const colors = useThemeColors();
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
				disabled={disabled}
				accessibilityLabel={added ? "Already added" : `Add ${title}`}
				onPress={onToggle}
				className={cn(
					"size-8 items-center justify-center rounded-full",
					added ? "bg-primary" : "bg-background-subtle",
				)}
			>
				{added ? (
					<Check color="#3f2e00" size={18} strokeWidth={3} />
				) : (
					<Plus color={colors.mutedForeground} size={18} strokeWidth={2.5} />
				)}
			</Pressable>
		</View>
	);
}
