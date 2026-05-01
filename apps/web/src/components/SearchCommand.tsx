import {
	type ListSummaryDto,
	listsControllerGetUserListsOptions,
	type SocialUserCardDto,
	searchControllerSearchAllOptions,
	socialControllerSearchPeopleOptions,
	type UnifiedSearchResultDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	Calendar,
	Clock,
	Film,
	Home,
	List,
	Loader2,
	LogOut,
	Monitor,
	Moon,
	Search,
	Settings,
	Star,
	Sun,
	Tv,
	User,
	Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	CommandDialog,
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

const RESULTS_PER_SECTION = 8;

export function SearchCommand({
	open: controlledOpen,
	onOpenChange,
}: SearchCommandProps) {
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedQuery = useDebounce(searchQuery, 400);

	const isControlled = controlledOpen !== undefined;
	const isOpen = isControlled ? controlledOpen : open;
	const handleOpenChange = (value: boolean) => {
		if (isControlled) {
			onOpenChange?.(value);
		} else {
			setOpen(value);
		}
	};

	const isOpenRef = useRef(isOpen);
	isOpenRef.current = isOpen;
	const handleOpenChangeRef = useRef(handleOpenChange);
	handleOpenChangeRef.current = handleOpenChange;

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleOpenChangeRef.current(!isOpenRef.current);
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	useEffect(() => {
		if (!isOpen) {
			setSearchQuery("");
		}
	}, [isOpen]);

	const { user, logout } = useAuth();
	const currentUserHandle = user?.handle;
	const navigate = useNavigate();

	// Theme toggle state
	const [themeMode, setThemeMode] = useState<"light" | "dark" | "auto">("auto");

	useEffect(() => {
		if (typeof window === "undefined") return;
		const stored = window.localStorage.getItem("theme");
		if (stored === "light" || stored === "dark" || stored === "auto") {
			setThemeMode(stored);
		}
	}, []);

	function cycleTheme() {
		if (typeof window === "undefined") return;
		const nextMode: "light" | "dark" | "auto" =
			themeMode === "light" ? "dark" : themeMode === "dark" ? "auto" : "light";
		setThemeMode(nextMode);
		window.localStorage.setItem("theme", nextMode);

		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)",
		).matches;
		const resolved =
			nextMode === "auto" ? (prefersDark ? "dark" : "light") : nextMode;

		document.documentElement.classList.remove("light", "dark");
		document.documentElement.classList.add(resolved);

		if (nextMode === "auto") {
			document.documentElement.removeAttribute("data-theme");
		} else {
			document.documentElement.setAttribute("data-theme", nextMode);
		}
		document.documentElement.style.colorScheme = resolved;
	}

	const themeIcons = {
		light: Sun,
		dark: Moon,
		auto: Monitor,
	};

	const themeLabels = {
		light: "Light mode",
		dark: "Dark mode",
		auto: "System preference",
	};

	const ThemeIcon = themeIcons[themeMode];

	const {
		data: searchData,
		isLoading: isSearching,
		isError: isSearchError,
	} = useQuery({
		...searchControllerSearchAllOptions({
			query: { query: debouncedQuery },
		}),
		enabled: debouncedQuery.length > 0,
	});

	const { data: userLists } = useQuery({
		...listsControllerGetUserListsOptions(),
	});

	const {
		data: peopleData,
		isLoading: isSearchingPeople,
		isError: isPeopleError,
	} = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedQuery },
		}),
		enabled: debouncedQuery.length > 0,
	});

	const movies =
		searchData?.results?.filter(
			(item: UnifiedSearchResultDto) => item.media_type === "movie",
		) || [];

	const shows =
		searchData?.results?.filter(
			(item: UnifiedSearchResultDto) => item.media_type === "tv",
		) || [];

	const hasSearchQuery = debouncedQuery.length > 0;
	const hasSearchResults =
		movies.length > 0 ||
		shows.length > 0 ||
		(peopleData?.items && peopleData.items.length > 0);
	const isLoading = isSearching || isSearchingPeople;
	const hasError = isSearchError || isPeopleError;

	const getTitle = (item: UnifiedSearchResultDto): string => {
		return item.title || item.name || "Unknown";
	};

	const getYear = (item: UnifiedSearchResultDto): string => {
		const date = item.release_date || item.first_air_date;
		if (date) {
			return new Date(date).getFullYear().toString();
		}
		return "";
	};

	const goTo = (to: string, params?: Record<string, string>) => {
		handleOpenChange(false);
		if (params) {
			navigate({ to, params });
		} else {
			navigate({ to });
		}
	};

	const goToSearch = (type?: string) => {
		handleOpenChange(false);
		navigate({
			to: "/search",
			search: {
				q: debouncedQuery,
				...(type ? { type } : {}),
			},
		});
	};

	return (
		<>
			<button
				type="button"
				onClick={() => handleOpenChange(true)}
				className="group flex h-9 items-center gap-2 rounded-md border border-(--border) bg-(--background-elevated) px-3 text-(--foreground-muted) transition-colors hover:border-(--border-strong) hover:bg-(--background-subtle) hover:text-(--foreground)"
				aria-label="Search"
			>
				<Search className="size-4" />
				<span className="hidden text-sm sm:inline">Search</span>
				<kbd className="ml-1 hidden h-5 select-none items-center gap-0.5 rounded border border-(--border-strong) bg-(--background-subtle) px-1.5 font-medium font-mono text-(--foreground-muted) text-[10px] sm:flex">
					<span>⌘</span>K
				</kbd>
			</button>

			<CommandDialog
				open={isOpen}
				onOpenChange={handleOpenChange}
				commandProps={{ shouldFilter: false }}
			>
				<CommandInput
					placeholder="Search movies, shows, lists..."
					value={searchQuery}
					onValueChange={setSearchQuery}
				/>
				<CommandList>
					{/* Loading */}
					{hasSearchQuery && isLoading && (
						<div className="flex items-center justify-center py-8 text-(--foreground-muted)">
							<Loader2 className="mr-2 size-5 animate-spin" />
							<span>Searching...</span>
						</div>
					)}

					{/* Error */}
					{hasSearchQuery && !isLoading && hasError && (
						<div className="flex flex-col items-center gap-2 py-6 text-(--foreground-muted)">
							<p>Something went wrong.</p>
							<p className="text-sm">Try again in a moment.</p>
						</div>
					)}

					{/* Empty state */}
					{hasSearchQuery && !isLoading && !hasError && !hasSearchResults && (
						<div className="flex flex-col items-center gap-2 py-6 text-(--foreground-muted)">
							<Search className="size-8 opacity-50" />
							<p>No results found for &quot;{debouncedQuery}&quot;</p>
							<p className="text-sm">
								Try searching for movies, TV shows, or people
							</p>
						</div>
					)}

					{/* Search results */}
					{hasSearchQuery && !isLoading && !hasError && hasSearchResults && (
						<>
							{/* Movies */}
							{movies.length > 0 && (
								<CommandGroup heading="Movies">
									{movies
										.slice(0, RESULTS_PER_SECTION)
										.map((movie: UnifiedSearchResultDto) => {
											const title = getTitle(movie);
											return (
												<CommandItem
													key={`movie-${movie.id}`}
													value={`movie ${title} ${getYear(movie)}`}
													onSelect={() => goTo(buildMovieUrl(movie.id, title))}
												>
													<Film className="shrink-0" />
													<span className="truncate">{title}</span>
													{getYear(movie) && (
														<span className="shrink-0 text-(--foreground-muted)">
															({getYear(movie)})
														</span>
													)}
													<CommandShortcut>
														<span className="flex items-center gap-1">
															<Star />
															{movie.vote_average?.toFixed(1) || "N/A"}
														</span>
													</CommandShortcut>
												</CommandItem>
											);
										})}
									{movies.length > RESULTS_PER_SECTION && (
										<CommandItem
											value="more movies"
											onSelect={() => goToSearch("movies")}
										>
											<Search />
											<span>Show more results</span>
										</CommandItem>
									)}
								</CommandGroup>
							)}

							{/* TV Shows */}
							{shows.length > 0 && (
								<CommandGroup heading="TV Shows">
									{shows
										.slice(0, RESULTS_PER_SECTION)
										.map((show: UnifiedSearchResultDto) => {
											const title = getTitle(show);
											return (
												<CommandItem
													key={`show-${show.id}`}
													value={`show ${title} ${getYear(show)}`}
													onSelect={() => goTo(buildShowUrl(show.id, title))}
												>
													<Tv className="shrink-0" />
													<span className="truncate">{title}</span>
													{getYear(show) && (
														<span className="shrink-0 text-(--foreground-muted)">
															({getYear(show)})
														</span>
													)}
													<CommandShortcut>
														<span className="flex items-center gap-1">
															<Star />
															{show.vote_average?.toFixed(1) || "N/A"}
														</span>
													</CommandShortcut>
												</CommandItem>
											);
										})}
									{shows.length > RESULTS_PER_SECTION && (
										<CommandItem
											value="more shows"
											onSelect={() => goToSearch("shows")}
										>
											<Search />
											<span>Show more results</span>
										</CommandItem>
									)}
								</CommandGroup>
							)}

							{/* People */}
							{peopleData?.items && peopleData.items.length > 0 && (
								<CommandGroup
									heading={`People (${peopleData.items.length} result${peopleData.items.length === 1 ? "" : "s"})`}
								>
									{peopleData.items
										.slice(0, RESULTS_PER_SECTION)
										.map((person: SocialUserCardDto) => {
											const name = String(
												person.displayName || person.handle || "Unknown",
											);
											return (
												<CommandItem
													key={`person-${person.did}`}
													value={`person ${name} ${person.handle}`}
													onSelect={() =>
														goTo("/profile/$handle", {
															handle: person.handle || person.did,
														})
													}
												>
													<User className="shrink-0" />
													<span className="truncate">{name}</span>
													{person.handle && (
														<span className="shrink-0 text-(--foreground-muted)">
															@{String(person.handle)}
														</span>
													)}
												</CommandItem>
											);
										})}
									{peopleData.items.length > RESULTS_PER_SECTION && (
										<CommandItem
											value="more people"
											onSelect={() => goToSearch("people")}
										>
											<Search />
											<span>Show more results</span>
										</CommandItem>
									)}
								</CommandGroup>
							)}
						</>
					)}

					{/* Navigation — only when not searching */}
					{!hasSearchQuery && (
						<CommandGroup heading="Navigation">
							<CommandItem
								value="dashboard"
								onSelect={() => goTo("/dashboard")}
							>
								<Home />
								<span>Dashboard</span>
							</CommandItem>
							<CommandItem value="calendar" onSelect={() => goTo("/calendar")}>
								<Calendar />
								<span>Calendar</span>
							</CommandItem>
							<CommandItem
								value="following"
								onSelect={() => goTo("/following")}
							>
								<Users />
								<span>Following</span>
							</CommandItem>
							{currentUserHandle && (
								<CommandItem
									value="up next"
									onSelect={() =>
										goTo("/profile/$handle/up-next", {
											handle: currentUserHandle,
										})
									}
								>
									<Clock />
									<span>Up Next</span>
								</CommandItem>
							)}
							{currentUserHandle && (
								<CommandItem
									value="profile"
									onSelect={() =>
										goTo("/profile/$handle", {
											handle: currentUserHandle,
										})
									}
								>
									<User />
									<span>Profile</span>
								</CommandItem>
							)}
							{currentUserHandle && (
								<CommandItem
									value="lists"
									onSelect={() =>
										goTo("/profile/$handle/lists", {
											handle: currentUserHandle,
										})
									}
								>
									<List />
									<span>Lists</span>
								</CommandItem>
							)}
						</CommandGroup>
					)}

					{/* Your Lists */}
					{userLists && userLists.length > 0 && currentUserHandle && (
						<>
							<CommandSeparator />
							<CommandGroup heading="Your Lists">
								{userLists
									.slice(0, RESULTS_PER_SECTION)
									.map((list: ListSummaryDto) => (
										<CommandItem
											key={`list-${list.id}`}
											value={`list ${list.name}`}
											onSelect={() =>
												goTo("/profile/$handle/lists/$listSlug", {
													handle: currentUserHandle,
													listSlug: list.slug,
												})
											}
										>
											<List />
											<span>{list.name}</span>
											<CommandShortcut>{list.itemCount} items</CommandShortcut>
										</CommandItem>
									))}
							</CommandGroup>
						</>
					)}

					{/* Quick Actions */}
					<CommandSeparator />
					<CommandGroup heading="Quick Actions">
						<CommandItem value="settings" onSelect={() => goTo("/settings")}>
							<Settings />
							<span>Settings</span>
						</CommandItem>
						<CommandItem
							value="theme"
							onSelect={() => {
								cycleTheme();
							}}
						>
							<ThemeIcon className="h-4 w-4" />
							<span>{themeLabels[themeMode]}</span>
						</CommandItem>
						{currentUserHandle && (
							<CommandItem
								value="sign out"
								onSelect={() => {
									handleOpenChange(false);
									logout();
								}}
							>
								<LogOut />
								<span>Sign Out</span>
							</CommandItem>
						)}
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</>
	);
}

export default SearchCommand;
