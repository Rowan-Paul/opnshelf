import {
	discoverControllerBecauseYouWatchedOptions,
	discoverControllerFromFollowsOptions,
	discoverControllerTrendingOptions,
	type PersonSearchResultDto,
	peopleControllerSearchPeopleOptions,
	searchControllerSearchAllOptions,
	socialControllerSearchPeopleOptions,
	type UnifiedSearchResultDto,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link } from "expo-router";
import {
	ChevronRight,
	Clapperboard,
	Search,
	SearchX,
	User,
	Users,
	X,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { MediaCard, type MediaCardItem } from "@/components/media/MediaCard";
import { PersonRow } from "@/components/media/PersonRow";
import { Screen } from "@/components/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";
import { profileUrl, yearFromDate } from "@/lib/tmdb";
import { useDebounce } from "@/lib/use-debounce";
import { useMediaCardColumns } from "@/lib/use-media-card-columns";
import { useTwStyle } from "@/lib/use-tw-style";

type Tab = "all" | "movies" | "shows" | "cast" | "people";

const TABS: { key: Tab; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "movies", label: "Movies" },
	{ key: "shows", label: "Shows" },
	{ key: "cast", label: "Cast & Crew" },
	{ key: "people", label: "People" },
];

/**
 * Row for a TMDB person (cast/crew) search result: headshot, name, department.
 * Tapping opens the person detail page (`/person/[id]`). Distinct from
 * `PersonRow`, which is for app users (social) and links to a profile.
 */
function CastCrewRow({ person }: { person: PersonSearchResultDto }) {
	const url = profileUrl(person.profile_path);
	return (
		<Link href={`/person/${person.id}` as const} asChild>
			<Pressable className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-3">
				<View className="size-11 items-center justify-center overflow-hidden rounded-full bg-background-subtle">
					{url ? (
						<Image
							source={{ uri: url }}
							style={{ width: 44, height: 44 }}
							contentFit="cover"
						/>
					) : (
						<User color="#94a3b8" size={20} />
					)}
				</View>
				<View className="min-w-0 flex-1">
					<Text
						className="font-medium text-foreground text-sm"
						numberOfLines={1}
					>
						{person.name}
					</Text>
					{person.known_for_department ? (
						<Text className="text-muted-foreground text-xs" numberOfLines={1}>
							{person.known_for_department}
						</Text>
					) : null}
				</View>
				<ChevronRight color="#94a3b8" size={18} />
			</Pressable>
		</Link>
	);
}

function toMediaCardItem(r: UnifiedSearchResultDto): MediaCardItem {
	const isMovie = r.media_type === "movie";
	return {
		id: r.id,
		type: isMovie ? "movie" : "show",
		title: r.title || r.name || "Untitled",
		posterPath: r.poster_path,
		year: yearFromDate(isMovie ? r.release_date : r.first_air_date),
		rating: r.vote_average,
	};
}

/** Horizontal rail mirroring SimilarMedia's SimilarRail. Renders nothing when empty. */
function DiscoverRail({
	title,
	items,
}: {
	title: string;
	items: MediaCardItem[];
}) {
	if (items.length === 0) return null;
	return (
		<View className="pt-2 pb-4">
			<Text className="mb-3 px-4 font-display font-semibold text-base text-foreground">
				{title}
			</Text>
			{/* Horizontal ScrollView, not FlatList: these rails live inside a
			    vertical ScrollView, and nested VirtualizedLists mis-measure their
			    height (later rails get clipped). Rails are short, so no
			    virtualization needed. items-start: horizontal ScrollView content
			    defaults to cross-axis stretch, which collapses aspect-ratio cards
			    (see CircleFilterBar). */}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerClassName="items-start gap-3 px-4"
			>
				{items.map((item) => (
					<View key={`${item.type}-${item.id}`} className="w-28">
						<MediaCard item={item} actions />
					</View>
				))}
			</ScrollView>
		</View>
	);
}

/** Default landing state of the search tab when the query is empty. */
function DiscoverSections({ isAuthenticated }: { isAuthenticated: boolean }) {
	const fromFollows = useQuery({
		...discoverControllerFromFollowsOptions(),
		enabled: isAuthenticated,
	});
	const becauseYouWatched = useQuery({
		...discoverControllerBecauseYouWatchedOptions(),
		enabled: isAuthenticated,
	});
	const trending = useQuery(discoverControllerTrendingOptions());

	const followsItems = (fromFollows.data?.results ?? []).map(toMediaCardItem);
	const trendingItems = (trending.data?.results ?? []).map(toMediaCardItem);
	const rows = becauseYouWatched.data?.rows ?? [];

	const [refreshing, setRefreshing] = useState(false);
	const onRefresh = async () => {
		setRefreshing(true);
		await Promise.all([
			trending.refetch(),
			isAuthenticated ? fromFollows.refetch() : null,
			isAuthenticated ? becauseYouWatched.refetch() : null,
		]);
		setRefreshing(false);
	};

	return (
		<ScrollView
			contentContainerClassName="pb-8"
			showsVerticalScrollIndicator={false}
			keyboardShouldPersistTaps="handled"
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}
		>
			<DiscoverRail title="From your follows" items={followsItems} />
			{rows.map((row) => (
				<DiscoverRail
					key={`${row.seedMediaType}-${row.seedId}`}
					title={`Because you watched ${row.seedTitle}`}
					items={row.results.map(toMediaCardItem)}
				/>
			))}
			<DiscoverRail title="Trending this week" items={trendingItems} />
		</ScrollView>
	);
}

export default function SearchScreen() {
	const { isAuthenticated } = useAuth();
	const [query, setQuery] = useState("");
	const [activeTab, setActiveTab] = useState<Tab>("all");
	const debouncedQuery = useDebounce(query.trim(), 350);
	const hasQuery = debouncedQuery.length > 0;

	const peopleListStyle = useTwStyle("px-4 pb-8");
	const gridListStyle = useTwStyle("px-3 pb-8");
	const numColumns = useMediaCardColumns();

	const mediaQuery = useQuery({
		...searchControllerSearchAllOptions({ query: { query: debouncedQuery } }),
		enabled: hasQuery && activeTab !== "people" && activeTab !== "cast",
	});

	const peopleQuery = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedQuery, pageSize: 20 },
		}),
		enabled: hasQuery && activeTab === "people",
	});

	// Cast & Crew (TMDB people) — public, only fetched on its own tab.
	const castQuery = useQuery({
		...peopleControllerSearchPeopleOptions({
			query: { query: debouncedQuery },
		}),
		enabled: hasQuery && activeTab === "cast",
	});

	const results = mediaQuery.data?.results ?? [];
	const movies = useMemo(
		() => results.filter((r) => r.media_type === "movie").map(toMediaCardItem),
		[results],
	);
	const shows = useMemo(
		() => results.filter((r) => r.media_type === "tv").map(toMediaCardItem),
		[results],
	);
	const allMedia = useMemo(() => results.map(toMediaCardItem), [results]);
	const people = peopleQuery.data?.items ?? [];
	const cast = castQuery.data?.results ?? [];

	const isPeople = activeTab === "people";
	const isCast = activeTab === "cast";
	const activeQuery = isPeople ? peopleQuery : isCast ? castQuery : mediaQuery;
	const gridData =
		activeTab === "movies" ? movies : activeTab === "shows" ? shows : allMedia;

	const refreshControl = (
		<RefreshControl
			refreshing={activeQuery.isRefetching}
			onRefresh={() => {
				void activeQuery.refetch();
			}}
			tintColor="#f3bc00"
			colors={["#f3bc00"]}
		/>
	);

	function renderBody() {
		if (!hasQuery) {
			return <DiscoverSections isAuthenticated={isAuthenticated} />;
		}
		if (activeQuery.isLoading) {
			return <LoadingState label="Searching…" />;
		}
		if (activeQuery.isError) {
			return <ErrorState message="Couldn't load search results. Try again." />;
		}

		if (isPeople) {
			if (people.length === 0) {
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
					data={people}
					keyExtractor={(p) => p.did}
					renderItem={({ item }) => (
						<View className="pb-2">
							<PersonRow person={item} />
						</View>
					)}
					contentContainerStyle={peopleListStyle}
					keyboardShouldPersistTaps="handled"
					refreshControl={refreshControl}
				/>
			);
		}

		if (isCast) {
			if (cast.length === 0) {
				return (
					<EmptyState
						icon={Clapperboard}
						title="No cast or crew found"
						message={`Nobody matched “${debouncedQuery}”.`}
					/>
				);
			}
			return (
				<FlashList
					data={cast}
					keyExtractor={(p) => String(p.id)}
					renderItem={({ item }) => (
						<View className="pb-2">
							<CastCrewRow person={item} />
						</View>
					)}
					contentContainerStyle={peopleListStyle}
					keyboardShouldPersistTaps="handled"
					refreshControl={refreshControl}
				/>
			);
		}

		if (gridData.length === 0) {
			return (
				<EmptyState
					icon={SearchX}
					title="No results"
					message={`Nothing matched “${debouncedQuery}”.`}
				/>
			);
		}

		return (
			<FlashList
				key={`grid-${numColumns}`}
				data={gridData}
				numColumns={numColumns}
				keyExtractor={(item) => `${item.type}-${item.id}`}
				renderItem={({ item }) => (
					<View className="flex-1 px-1 pb-3">
						<MediaCard item={item} actions />
					</View>
				)}
				contentContainerStyle={gridListStyle}
				keyboardShouldPersistTaps="handled"
				refreshControl={refreshControl}
			/>
		);
	}

	return (
		<Screen className="px-0">
			<View className="px-4 pt-3 pb-3">
				<Text className="mb-3 font-bold font-display text-2xl text-foreground">
					Search
				</Text>
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
					placeholder="Movies, shows, people…"
					autoCapitalize="none"
					autoCorrect={false}
					returnKeyType="search"
				/>

				<View className="mt-3 flex-row gap-2">
					{TABS.map((tab) => {
						const isActive = activeTab === tab.key;
						return (
							<Pressable
								key={tab.key}
								onPress={() => setActiveTab(tab.key)}
								className={cn(
									"rounded-full px-3 py-1.5",
									isActive ? "bg-primary" : "bg-background-subtle",
								)}
							>
								<Text
									className={cn(
										"font-medium text-sm",
										isActive
											? "text-primary-foreground"
											: "text-muted-foreground",
									)}
								>
									{tab.label}
								</Text>
							</Pressable>
						);
					})}
				</View>
			</View>

			<View className="flex-1">{renderBody()}</View>
		</Screen>
	);
}
