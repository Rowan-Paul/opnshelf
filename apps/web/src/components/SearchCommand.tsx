import {
	client,
	type ListSummaryDto,
	listsControllerGetUserListsOptions,
	type PersonSearchResultDto,
	peopleControllerSearchPeopleOptions,
	type SocialUserCardDto,
	searchControllerSearchAllOptions,
	socialControllerSearchPeopleOptions,
	type UnifiedSearchResultDto,
} from "@opnshelf/api";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	Calendar,
	Clapperboard,
	Clock,
	Film,
	Home,
	List,
	Loader2,
	LogOut,
	MessageSquare,
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
import { FeedbackDialog } from "#/components/FeedbackDialog";
import {
	CommandDialog,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "#/components/ui/command";
import { posthog } from "#/integrations/posthog/provider";
import { useAuth } from "#/lib/auth-context";
import { buildMovieUrl, buildPersonUrl, buildShowUrl } from "#/lib/url-utils";

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

const RESULTS_PER_SECTION = 3;

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

	const { user, logout, isAuthenticated } = useAuth();
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

	// Feedback dialog state
	const [feedbackOpen, setFeedbackOpen] = useState(false);

	const submitFeedbackMutation = useMutation({
		mutationKey: ["feedback", "submit"],
		mutationFn: async (data: {
			category: "bug" | "feature_request";
			message: string;
		}) => {
			const { data: responseData, error } = await client.post({
				url: "/feedback",
				body: { ...data, pageUrl: window.location.href },
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (error) {
				throw error;
			}

			return responseData;
		},
		onSuccess: (_data, variables) => {
			posthog.capture("feedback_submitted", { category: variables.category });
		},
	});

	const {
		data: searchData,
		isLoading: isSearching,
		isError: isSearchError,
	} = useQuery({
		...searchControllerSearchAllOptions({
			query: { query: debouncedQuery },
		}),
		enabled: debouncedQuery.length > 0,
		placeholderData: keepPreviousData,
	});

	useEffect(() => {
		if (!debouncedQuery || !searchData) return;
		posthog.capture("search_performed", {
			surface: "command",
			tab: "all",
			query_length: debouncedQuery.length,
			result_count: searchData.results?.length ?? 0,
		});
	}, [debouncedQuery, searchData]);

	const { data: userLists } = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: isAuthenticated,
	});

	const {
		data: peopleData,
		isLoading: isSearchingPeople,
		isError: isPeopleError,
	} = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedQuery },
		}),
		enabled: debouncedQuery.length > 0 && isAuthenticated,
		placeholderData: keepPreviousData,
	});

	// Cast & Crew (TMDB people) — public, unlike the social user search above.
	const {
		data: castData,
		isLoading: isSearchingCast,
		isError: isCastError,
	} = useQuery({
		...peopleControllerSearchPeopleOptions({
			query: { query: debouncedQuery },
		}),
		enabled: debouncedQuery.length > 0,
		placeholderData: keepPreviousData,
	});

	const movies =
		searchData?.results?.filter(
			(item: UnifiedSearchResultDto) => item.media_type === "movie",
		) || [];

	const shows =
		searchData?.results?.filter(
			(item: UnifiedSearchResultDto) => item.media_type === "tv",
		) || [];

	const cast = castData?.results || [];

	const hasSearchQuery = debouncedQuery.length > 0;
	const hasSearchResults =
		movies.length > 0 ||
		shows.length > 0 ||
		(peopleData?.items && peopleData.items.length > 0) ||
		cast.length > 0;
	const isLoading = isSearching || isSearchingPeople || isSearchingCast;
	const hasError = isSearchError || isPeopleError || isCastError;

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

	// Local, instantly-filterable palette entries (pages + actions). Lists come
	// from userLists. Matching is plain substring, not cmdk fuzzy — the command
	// has shouldFilter:false so cmdk never hides server-ranked media/people.
	// ponytail: substring match; swap in a fuzzy scorer only if users complain.
	const pages = isAuthenticated
		? [
				{
					key: "dashboard",
					label: "Dashboard",
					Icon: Home,
					run: () => goTo("/dashboard"),
				},
				{
					key: "calendar",
					label: "Calendar",
					Icon: Calendar,
					run: () => goTo("/calendar"),
				},
				{
					key: "following",
					label: "Following",
					Icon: Users,
					run: () => goTo("/following"),
				},
				...(currentUserHandle
					? [
							{
								key: "up-next",
								label: "Up Next",
								Icon: Clock,
								run: () =>
									goTo("/profile/$handle/up-next", {
										handle: currentUserHandle,
									}),
							},
							{
								key: "profile",
								label: "Profile",
								Icon: User,
								run: () =>
									goTo("/profile/$handle", { handle: currentUserHandle }),
							},
							{
								key: "lists",
								label: "Lists",
								Icon: List,
								run: () =>
									goTo("/profile/$handle/lists", { handle: currentUserHandle }),
							},
						]
					: []),
			]
		: [];

	const actions = [
		{
			key: "settings",
			label: "Settings",
			keywords: "",
			Icon: Settings,
			run: () => goTo("/settings"),
		},
		{
			key: "theme",
			label: themeLabels[themeMode],
			keywords: "theme appearance dark light system mode",
			Icon: ThemeIcon,
			run: cycleTheme,
		},
		{
			key: "feedback",
			label: "Send feedback",
			keywords: "bug report feature request",
			Icon: MessageSquare,
			run: () => {
				handleOpenChange(false);
				setFeedbackOpen(true);
			},
		},
		...(currentUserHandle
			? [
					{
						key: "sign-out",
						label: "Sign Out",
						keywords: "logout log out",
						Icon: LogOut,
						run: () => {
							handleOpenChange(false);
							logout();
						},
					},
				]
			: []),
	];

	const q = debouncedQuery.trim().toLowerCase();
	const matchedPages = q
		? pages.filter((p) => p.label.toLowerCase().includes(q))
		: [];
	const matchedActions = q
		? actions.filter((a) =>
				`${a.label} ${a.keywords}`.toLowerCase().includes(q),
			)
		: [];
	const matchedLists =
		q && userLists
			? userLists.filter((l) => l.name.toLowerCase().includes(q))
			: [];
	const hasLocalMatches =
		matchedPages.length > 0 ||
		matchedActions.length > 0 ||
		matchedLists.length > 0;

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
				<CommandList className="h-[300px]">
					{/* Local matches — pages, lists, actions — surfaced on top while searching */}
					{hasSearchQuery && matchedPages.length > 0 && (
						<CommandGroup heading="Pages">
							{matchedPages.map(({ key, label, Icon, run }) => (
								<CommandItem
									key={`page-${key}`}
									value={`page ${label}`}
									onSelect={run}
								>
									<Icon className="shrink-0" />
									<span>{label}</span>
								</CommandItem>
							))}
						</CommandGroup>
					)}

					{hasSearchQuery && matchedLists.length > 0 && currentUserHandle && (
						<CommandGroup heading="Lists">
							{matchedLists.map((list: ListSummaryDto) => (
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
									<List className="shrink-0" />
									<span className="truncate">{list.name}</span>
									<CommandShortcut>{list.itemCount} items</CommandShortcut>
								</CommandItem>
							))}
						</CommandGroup>
					)}

					{hasSearchQuery && matchedActions.length > 0 && (
						<CommandGroup heading="Actions">
							{matchedActions.map(({ key, label, Icon, run }) => (
								<CommandItem
									key={`action-${key}`}
									value={`action ${label}`}
									onSelect={run}
								>
									<Icon className="shrink-0" />
									<span>{label}</span>
								</CommandItem>
							))}
						</CommandGroup>
					)}

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
					{hasSearchQuery &&
						!isLoading &&
						!hasError &&
						!hasSearchResults &&
						!hasLocalMatches && (
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
													onSelect={() => {
														posthog.capture("discover_item_opened", {
															surface: "command",
															result_type: "movie",
														});
														goTo(buildMovieUrl(movie.id, title));
													}}
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
													onSelect={() => {
														posthog.capture("discover_item_opened", {
															surface: "command",
															result_type: "show",
														});
														goTo(buildShowUrl(show.id, title));
													}}
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

							{/* Cast & Crew (TMDB people — actors, directors, crew) */}
							{cast.length > 0 && (
								<CommandGroup heading="Cast & Crew">
									{cast
										.slice(0, RESULTS_PER_SECTION)
										.map((person: PersonSearchResultDto) => (
											<CommandItem
												key={`cast-${person.id}`}
												value={`cast ${person.name} ${person.known_for_department ?? ""}`}
												onSelect={() =>
													goTo(buildPersonUrl(person.id, person.name))
												}
											>
												<Clapperboard className="shrink-0" />
												<span className="truncate">{person.name}</span>
												{person.known_for_department && (
													<span className="shrink-0 text-(--foreground-muted)">
														{person.known_for_department}
													</span>
												)}
											</CommandItem>
										))}
									{cast.length > RESULTS_PER_SECTION && (
										<CommandItem
											value="more cast"
											onSelect={() => goToSearch("cast")}
										>
											<Search />
											<span>Show more results</span>
										</CommandItem>
									)}
								</CommandGroup>
							)}
						</>
					)}

					{/* Navigation — only when not searching and authenticated */}
					{!hasSearchQuery && isAuthenticated && (
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
					{!hasSearchQuery &&
						userLists &&
						userLists.length > 0 &&
						currentUserHandle && (
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
												<CommandShortcut>
													{list.itemCount} items
												</CommandShortcut>
											</CommandItem>
										))}
								</CommandGroup>
							</>
						)}

					{/* Quick Actions */}
					{!hasSearchQuery && (
						<>
							<CommandSeparator />
							<CommandGroup heading="Quick Actions">
								<CommandItem
									value="settings"
									onSelect={() => goTo("/settings")}
								>
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
								<CommandItem
									value="feedback"
									onSelect={() => {
										handleOpenChange(false);
										setFeedbackOpen(true);
									}}
								>
									<MessageSquare className="h-4 w-4" />
									<span>Send feedback</span>
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
						</>
					)}
				</CommandList>
			</CommandDialog>

			<FeedbackDialog
				open={feedbackOpen}
				onOpenChange={setFeedbackOpen}
				onSubmit={async (data) => {
					await submitFeedbackMutation.mutateAsync(data);
				}}
				isSubmitting={submitFeedbackMutation.isPending}
			/>
		</>
	);
}

export default SearchCommand;
