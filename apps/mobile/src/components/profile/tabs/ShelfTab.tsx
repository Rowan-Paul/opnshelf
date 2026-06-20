import type { ShelfResponseDto } from "@opnshelf/api";
import { Link } from "expo-router";
import { Clock, Film, Search, Tv, X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { mediaHref } from "@/lib/media-href";
import { posterUrl } from "@/lib/tmdb";
import { useDebounce } from "@/lib/use-debounce";
import { useProfileShelf } from "@/lib/use-public-profile";

type ShelfItem = ShelfResponseDto["items"][number];
type Filter = "all" | "movie" | "episode";

const FILTERS: { key: Filter; label: string; icon?: typeof Film }[] = [
	{ key: "all", label: "All" },
	{ key: "movie", label: "Movies", icon: Film },
	{ key: "episode", label: "TV", icon: Tv },
];

function formatWatchedDate(iso?: string | null): string | undefined {
	if (!iso) return undefined;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return undefined;
	return d.toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/**
 * A single shelf entry. Mirrors the web shelf card: movies show the release
 * year, episodes show an "S{n}E{n}" label + episode title; both show the
 * watched date when available. Taps through to the matching detail route.
 */
function ShelfCard({ item }: { item: ShelfItem }) {
	const isMovie = item.type === "movie";
	const href = isMovie
		? mediaHref({ mediaType: "movie", mediaId: String(item.movieId) })
		: mediaHref({
				mediaType: "episode",
				mediaId: String(item.showId),
				seasonNumber: item.seasonNumber,
				episodeNumber: item.episodeNumber,
			});

	const watched = formatWatchedDate(item.watchedDate);

	return (
		<Link href={href} asChild>
			<Pressable className="flex-1">
				<View className="overflow-hidden rounded-lg border border-border bg-card">
					<PosterImage
						url={posterUrl(item.posterPath)}
						className="aspect-2/3 w-full"
					/>
				</View>
				{isMovie ? (
					<>
						<Text
							className="mt-2 font-medium text-foreground text-sm"
							numberOfLines={1}
						>
							{item.title}
						</Text>
						{item.releaseYear ? (
							<Text className="mt-0.5 text-muted-foreground text-xs">
								{item.releaseYear}
							</Text>
						) : null}
					</>
				) : (
					<>
						<Text
							className="mt-2 font-medium text-foreground text-sm"
							numberOfLines={1}
						>
							S{item.seasonNumber}E{item.episodeNumber}
						</Text>
						{item.episodeTitle ? (
							<Text
								className="mt-0.5 text-muted-foreground text-xs"
								numberOfLines={1}
							>
								{item.episodeTitle}
							</Text>
						) : null}
						<Text
							className="mt-0.5 text-muted-foreground text-xs"
							numberOfLines={1}
						>
							{item.showTitle}
						</Text>
					</>
				)}
				{watched ? (
					<View className="mt-0.5 flex-row items-center gap-1">
						<Clock color="#94a3b8" size={11} />
						<Text className="text-muted-foreground text-xs">{watched}</Text>
					</View>
				) : null}
			</Pressable>
		</Link>
	);
}

/**
 * Shelf tab: server-paginated grid of the user's watched movies + episodes,
 * with type filter pills and a search box. Mirrors the web shelf page.
 * Rendered inside the parent screen's scroll view, so it does not own a list.
 */
export function ShelfTab({
	userDid,
	initialFilter = "all",
}: {
	userDid: string;
	initialFilter?: Filter;
}) {
	const [filter, setFilter] = useState<Filter>(initialFilter);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const debounced = useDebounce(search.trim(), 350);

	const { data, isLoading, isError } = useProfileShelf(userDid, {
		page,
		type: filter === "all" ? undefined : filter,
		search: debounced,
	});

	const items = data?.items ?? [];
	const totalPages = data?.totalPages ?? 1;

	const changeFilter = (next: Filter) => {
		setFilter(next);
		setPage(1);
	};

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<Text className="font-bold font-display text-2xl text-foreground">
				Shelf
			</Text>

			<TextField
				leading={<Search color="#94a3b8" size={18} />}
				trailing={
					search.length > 0 ? (
						<Pressable hitSlop={8} onPress={() => setSearch("")}>
							<X color="#94a3b8" size={18} />
						</Pressable>
					) : null
				}
				value={search}
				onChangeText={(v) => {
					setSearch(v);
					setPage(1);
				}}
				placeholder="Search shelf…"
				autoCapitalize="none"
				autoCorrect={false}
			/>

			<View className="flex-row gap-2">
				{FILTERS.map((f) => {
					const isActive = filter === f.key;
					const Icon = f.icon;
					return (
						<Pressable
							key={f.key}
							onPress={() => changeFilter(f.key)}
							className={cn(
								"flex-row items-center gap-1.5 rounded-full px-3 py-1.5",
								isActive ? "bg-primary" : "bg-background-subtle",
							)}
						>
							{Icon ? (
								<Icon color={isActive ? "#3f2e00" : "#94a3b8"} size={14} />
							) : null}
							<Text
								className={cn(
									"font-medium text-sm",
									isActive
										? "text-primary-foreground"
										: "text-muted-foreground",
								)}
							>
								{f.label}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{isLoading ? (
				<View className="py-16">
					<ActivityIndicator color="#f3bc00" />
				</View>
			) : isError ? (
				<ErrorState message="Couldn't load this shelf." />
			) : items.length === 0 ? (
				<EmptyState
					icon={Film}
					title={debounced ? "No results" : "Shelf is empty"}
					message={debounced ? `Nothing matched “${debounced}”.` : undefined}
				/>
			) : (
				<View className="flex-row flex-wrap">
					{items.map((item) => (
						<View key={item.id} className="w-1/3 px-1 pb-3">
							<ShelfCard item={item} />
						</View>
					))}
				</View>
			)}

			{totalPages > 1 ? (
				<View className="flex-row items-center justify-center gap-4 pt-2">
					<Pressable
						disabled={page <= 1}
						onPress={() => setPage((p) => Math.max(1, p - 1))}
						className={cn(
							"rounded-lg border border-border px-4 py-2",
							page <= 1 && "opacity-40",
						)}
					>
						<Text className="font-medium text-foreground text-sm">Prev</Text>
					</Pressable>
					<Text className="text-muted-foreground text-sm">
						{page} / {totalPages}
					</Text>
					<Pressable
						disabled={page >= totalPages}
						onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
						className={cn(
							"rounded-lg border border-border px-4 py-2",
							page >= totalPages && "opacity-40",
						)}
					>
						<Text className="font-medium text-foreground text-sm">Next</Text>
					</Pressable>
				</View>
			) : null}
		</View>
	);
}
