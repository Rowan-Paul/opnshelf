import {
	type ListSummaryDto,
	listsControllerGetUserListsOptions,
	type SocialUserCardDto,
	searchControllerSearchAllOptions,
	socialControllerSearchPeopleOptions,
	type UnifiedSearchResultDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	Calendar,
	Clock,
	Film,
	Heart,
	Home,
	List,
	Loader2,
	Search,
	Settings,
	Star,
	Tv,
	User,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "#/components/ui/command";
import { useAuth } from "#/lib/auth-context";
import { buildMovieUrl, buildShowUrl } from "#/lib/url-utils";

interface SearchCommandProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(timer);
		};
	}, [value, delay]);

	return debouncedValue;
}

export function SearchCommand({
	open: controlledOpen,
	onOpenChange,
}: SearchCommandProps) {
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedQuery = useDebounce(searchQuery, 400);

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((open) => !open);
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	// Reset search when dialog closes
	useEffect(() => {
		if (!open) {
			setSearchQuery("");
		}
	}, [open]);

	const isOpen = controlledOpen !== undefined ? controlledOpen : open;
	const handleOpenChange = onOpenChange || setOpen;
	const { user } = useAuth();
	const currentUserHandle = user?.handle;

	// Search all API - only enabled when there's a search query
	const { data: searchData, isLoading: isSearching } = useQuery({
		...searchControllerSearchAllOptions({
			query: { query: debouncedQuery },
		}),
		enabled: debouncedQuery.length > 0,
	});

	// User lists - always fetched
	const { data: userLists } = useQuery({
		...listsControllerGetUserListsOptions(),
	});

	// People search - only enabled when there's a search query
	const { data: peopleData, isLoading: isSearchingPeople } = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedQuery },
		}),
		enabled: debouncedQuery.length > 0,
	});

	// Filter results by type
	const movies =
		searchData?.results?.filter(
			(item: UnifiedSearchResultDto) => item.media_type === "movie",
		) || [];

	const shows =
		searchData?.results?.filter(
			(item: UnifiedSearchResultDto) => item.media_type === "tv",
		) || [];

	const hasSearchQuery = debouncedQuery.length > 0;
	const hasResults =
		movies.length > 0 ||
		shows.length > 0 ||
		(userLists && userLists.length > 0);
	const isLoading = isSearching || isSearchingPeople;

	// Get the display title for a search result
	const getTitle = (item: UnifiedSearchResultDto): string => {
		return item.title || item.name || "Unknown";
	};

	// Get the release year for a search result
	const getYear = (item: UnifiedSearchResultDto): string => {
		const date = item.release_date || item.first_air_date;
		if (date) {
			return new Date(date).getFullYear().toString();
		}
		return "";
	};

	return (
		<>
			{/* Trigger button - can be placed anywhere */}
			<button
				type="button"
				onClick={() => handleOpenChange(true)}
				className="group flex h-9 items-center gap-2 rounded-md border border-(--border) bg-(--background-elevated) px-3 text-(--foreground-muted) transition-colors hover:border-(--border-strong) hover:bg-(--background-subtle) hover:text-(--foreground)"
				aria-label="Search"
			>
				<Search className="h-4 w-4" />
				<span className="hidden text-sm sm:inline">Search</span>
				<kbd className="ml-1 hidden h-5 select-none items-center gap-0.5 rounded border border-(--border-strong) bg-(--background-subtle) px-1.5 font-medium font-mono text-(--foreground-muted) text-[10px] sm:flex">
					<span>⌘</span>K
				</kbd>
			</button>

			<CommandDialog open={isOpen} onOpenChange={handleOpenChange}>
				<CommandInput
					placeholder="Search movies, shows, lists..."
					value={searchQuery}
					onValueChange={setSearchQuery}
				/>
				<CommandList>
					{/* Empty state */}
					{hasSearchQuery && !isLoading && !hasResults && (
						<CommandEmpty>
							<div className="flex flex-col items-center gap-2 py-6 text-(--foreground-muted)">
								<Search className="h-8 w-8 opacity-50" />
								<p>No results found for &quot;{debouncedQuery}&quot;</p>
								<p className="text-sm">
									Try searching for movies, TV shows, or people
								</p>
							</div>
						</CommandEmpty>
					)}

					{/* Loading state */}
					{isLoading && (
						<div className="flex items-center justify-center py-8 text-(--foreground-muted)">
							<Loader2 className="mr-2 h-5 w-5 animate-spin" />
							<span>Searching...</span>
						</div>
					)}

					{/* Navigation - Always shown */}
					<CommandGroup heading="Navigation">
						<CommandItem asChild>
							<Link to="/" className="flex items-center gap-2">
								<Home className="h-4 w-4" />
								<span>Dashboard</span>
							</Link>
						</CommandItem>
						<CommandItem asChild>
							<Link to="/calendar" className="flex items-center gap-2">
								<Calendar className="h-4 w-4" />
								<span>Calendar</span>
							</Link>
						</CommandItem>
						<CommandItem asChild>
							<Link to="/following" className="flex items-center gap-2">
								<Users className="h-4 w-4" />
								<span>Following</span>
							</Link>
						</CommandItem>
						{currentUserHandle && (
							<CommandItem asChild>
								<Link
									to="/profile/$handle/lists"
									params={{ handle: currentUserHandle }}
									className="flex items-center gap-2"
								>
									<List className="h-4 w-4" />
									<span>Lists</span>
								</Link>
							</CommandItem>
						)}
					</CommandGroup>

					{/* Movies Section */}
					{movies.length > 0 && (
						<>
							<CommandSeparator />
							<CommandGroup heading={`Movies (${movies.length})`}>
								{movies.slice(0, 5).map((movie: UnifiedSearchResultDto) => (
									<CommandItem key={`movie-${movie.id}`} asChild>
										<Link
											to={buildMovieUrl(movie.id, getTitle(movie))}
											className="flex items-center gap-2"
										>
											<Film className="h-4 w-4" />
											<span>{getTitle(movie)}</span>
											{getYear(movie) && (
												<span className="text-(--foreground-muted)">
													({getYear(movie)})
												</span>
											)}
											<CommandShortcut>
												<span className="flex items-center gap-1">
													<Star className="h-3 w-3" />
													{movie.vote_average?.toFixed(1) || "N/A"}
												</span>
											</CommandShortcut>
										</Link>
									</CommandItem>
								))}
							</CommandGroup>
						</>
					)}

					{/* TV Shows Section */}
					{shows.length > 0 && (
						<>
							<CommandSeparator />
							<CommandGroup heading={`TV Shows (${shows.length})`}>
								{shows.slice(0, 5).map((show: UnifiedSearchResultDto) => (
									<CommandItem key={`show-${show.id}`} asChild>
										<Link
											to={buildShowUrl(show.id, getTitle(show))}
											className="flex items-center gap-2"
										>
											<Tv className="h-4 w-4" />
											<span>{getTitle(show)}</span>
											{getYear(show) && (
												<span className="text-(--foreground-muted)">
													({getYear(show)})
												</span>
											)}
											<CommandShortcut>
												<span className="flex items-center gap-1">
													<Star className="h-3 w-3" />
													{show.vote_average?.toFixed(1) || "N/A"}
												</span>
											</CommandShortcut>
										</Link>
									</CommandItem>
								))}
							</CommandGroup>
						</>
					)}

					{/* Your Lists Section - Always shown when available */}
					{userLists && userLists.length > 0 && currentUserHandle && (
						<>
							<CommandSeparator />
							<CommandGroup heading="Your Lists">
								{userLists.slice(0, 5).map((list: ListSummaryDto) => (
									<CommandItem key={`list-${list.id}`} asChild>
										<Link
											to="/profile/$handle/lists/$listSlug"
											params={{
												handle: currentUserHandle,
												listSlug: list.slug,
											}}
											className="flex items-center gap-2"
										>
											<List className="h-4 w-4" />
											<span>{list.name}</span>
											<CommandShortcut>{list.itemCount} items</CommandShortcut>
										</Link>
									</CommandItem>
								))}
							</CommandGroup>
						</>
					)}

					{/* People Section */}
					{peopleData?.items && peopleData.items.length > 0 && (
						<>
							<CommandSeparator />
							<CommandGroup heading={`People (${peopleData.items.length})`}>
								{peopleData.items
									.slice(0, 5)
									.map((person: SocialUserCardDto) => (
										<CommandItem key={`person-${person.did}`} asChild>
											<Link
												to="/profile/$handle"
												params={{ handle: person.handle || person.did }}
												className="flex items-center gap-2"
											>
												<User className="h-4 w-4" />
												<span>
													{String(
														person.displayName || person.handle || "Unknown",
													)}
												</span>
												{person.handle && (
													<span className="text-(--foreground-muted)">
														@{String(person.handle)}
													</span>
												)}
											</Link>
										</CommandItem>
									))}
							</CommandGroup>
						</>
					)}

					{/* Quick Actions Section */}
					<CommandSeparator />
					<CommandGroup heading="Quick Actions">
						<CommandItem>
							<Clock className="h-4 w-4" />
							<span>Continue Watching</span>
						</CommandItem>
						<CommandItem>
							<Heart className="h-4 w-4" />
							<span>Favorites</span>
						</CommandItem>
						<CommandItem asChild>
							<Link to="/settings" className="flex items-center gap-2">
								<Settings className="h-4 w-4" />
								<span>Settings</span>
								<CommandShortcut>⌘S</CommandShortcut>
							</Link>
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</>
	);
}

export default SearchCommand;
