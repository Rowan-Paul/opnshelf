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
				className="group flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-3 text-[var(--foreground-muted)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--background-subtle)] hover:text-[var(--foreground)]"
				aria-label="Search"
			>
				<Search className="h-4 w-4" />
				<span className="hidden text-sm sm:inline">Search</span>
				<kbd className="ml-1 hidden h-5 select-none items-center gap-0.5 rounded border border-[var(--border-strong)] bg-[var(--background-subtle)] px-1.5 font-mono text-[10px] font-medium text-[var(--foreground-muted)] sm:flex">
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
							<div className="flex flex-col items-center gap-2 py-6 text-[var(--foreground-muted)]">
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
						<div className="flex items-center justify-center py-8 text-[var(--foreground-muted)]">
							<Loader2 className="h-5 w-5 animate-spin mr-2" />
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
						<CommandItem asChild>
							<Link to="/lists" className="flex items-center gap-2">
								<List className="h-4 w-4" />
								<span>Lists</span>
							</Link>
						</CommandItem>
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
												<span className="text-[var(--foreground-muted)]">
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
												<span className="text-[var(--foreground-muted)]">
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
					{userLists && userLists.length > 0 && (
						<>
							<CommandSeparator />
							<CommandGroup heading="Your Lists">
								{userLists.slice(0, 5).map((list: ListSummaryDto) => (
									<CommandItem key={`list-${list.id}`} asChild>
										<Link
											to="/lists/$slug"
											params={{ slug: list.slug }}
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
												to={
													`/profile/${person.handle || person.did}` as "/profile/$handle"
												}
												className="flex items-center gap-2"
											>
												<User className="h-4 w-4" />
												<span>
													{person.displayName || person.handle || "Unknown"}
												</span>
												{person.handle && (
													<span className="text-[var(--foreground-muted)]">
														@{person.handle}
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
						<CommandItem>
							<Settings className="h-4 w-4" />
							<span>Settings</span>
							<CommandShortcut>⌘S</CommandShortcut>
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</>
	);
}

export default SearchCommand;
