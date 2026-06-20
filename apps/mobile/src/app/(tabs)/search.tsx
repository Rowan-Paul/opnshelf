import {
	searchControllerSearchAllOptions,
	socialControllerSearchPeopleOptions,
	type UnifiedSearchResultDto,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Search, SearchX, Users, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { MediaCard, type MediaCardItem } from "@/components/media/MediaCard";
import { PersonRow } from "@/components/media/PersonRow";
import { Screen } from "@/components/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { yearFromDate } from "@/lib/tmdb";
import { useDebounce } from "@/lib/use-debounce";
import { useTwStyle } from "@/lib/use-tw-style";

type Tab = "all" | "movies" | "shows" | "people";

const TABS: { key: Tab; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "movies", label: "Movies" },
	{ key: "shows", label: "Shows" },
	{ key: "people", label: "People" },
];

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

export default function SearchScreen() {
	const [query, setQuery] = useState("");
	const [activeTab, setActiveTab] = useState<Tab>("all");
	const debouncedQuery = useDebounce(query.trim(), 350);
	const hasQuery = debouncedQuery.length > 0;

	const peopleListStyle = useTwStyle("px-4 pb-8");
	const gridListStyle = useTwStyle("px-3 pb-8");

	const mediaQuery = useQuery({
		...searchControllerSearchAllOptions({ query: { query: debouncedQuery } }),
		enabled: hasQuery && activeTab !== "people",
	});

	const peopleQuery = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedQuery, pageSize: 20 },
		}),
		enabled: hasQuery && activeTab === "people",
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

	const isPeople = activeTab === "people";
	const activeQuery = isPeople ? peopleQuery : mediaQuery;
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
			return (
				<EmptyState
					icon={Search}
					title="Search opnshelf"
					message="Find movies, shows, and people."
				/>
			);
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
				data={gridData}
				numColumns={3}
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
			<View className="px-4 pb-3">
				<Text className="mb-3 font-bold font-display text-2xl">Search</Text>
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
