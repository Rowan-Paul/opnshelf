import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Film, List, Loader2, Tv } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { UnauthenticatedState } from "@/components/UnauthenticatedState";
import { useUserSettings } from "@/hooks/useUserSettings";
import {
	createTitleSlug,
	formatDateOnly,
	getDayKeyInTimezone,
	getTmdbPosterUrl,
} from "@/lib/utils";
import { env } from "@/env";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ReleaseSource = "watching" | "watchlist";
type ReleaseKind = "episode" | "movie" | "show" | "season";

type ApiReleaseCalendarItem = {
	source: ReleaseSource;
	mediaType: "movie" | "show";
	releaseKind: "movie" | "show" | "episode";
	releaseDate: string;
	title: string;
	subtitle?: string;
	overview?: string;
	posterPath?: string;
	backdropPath?: string;
	showId?: string;
	movieId?: string;
	seasonNumber?: number;
	episodeNumber?: number;
};

type ApiReleaseCalendarResponse = {
	items: ApiReleaseCalendarItem[];
	total: number;
};

type ReleaseCalendarEvent = {
	id: string;
	dayKey: string;
	monthKey: string;
	source: ReleaseSource;
	kind: ReleaseKind;
	title: string;
	subtitle: string;
	description?: string;
	posterPath?: string | null;
	to: string;
	params: Record<string, string>;
};

type MonthOption = {
	monthKey: string;
	label: string;
	count: number;
};

export const Route = createFileRoute("/profile/calendar")({
	head: () => ({
		meta: [{ title: "Release Calendar | OpnShelf" }],
	}),
	component: ProfileCalendarPage,
});

function ProfileCalendarPage() {
	const { user, timezone } = useUserSettings();
	const [sourceFilter, setSourceFilter] = useState<ReleaseSource | "all">("all");
	const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
	const userDid = user?.did ?? "";

	const releaseCalendarQuery = useQuery({
		queryKey: ["shows", "release-calendar", userDid],
		enabled: !!userDid,
		queryFn: async () => {
			const response = await fetch(
				`${env.VITE_API_URL}/shows/user/${userDid}/release-calendar`,
				{
					credentials: "include",
					headers: {
						Accept: "application/json",
					},
				},
			);

			if (!response.ok) {
				throw new Error("Failed to load release calendar");
			}

			return (await response.json()) as ApiReleaseCalendarResponse;
		},
	});

	const releaseEvents = useMemo(() => {
		return buildReleaseCalendarEvents({
			timezone,
			items: releaseCalendarQuery.data?.items ?? [],
		});
	}, [timezone, releaseCalendarQuery.data?.items]);

	const filteredEvents = useMemo(() => {
		if (sourceFilter === "all") {
			return releaseEvents;
		}

		return releaseEvents.filter((event) => event.source === sourceFilter);
	}, [releaseEvents, sourceFilter]);

	const monthOptions = useMemo(() => {
		const months = new Map<string, MonthOption>();

		for (const event of filteredEvents) {
			const existingMonth = months.get(event.monthKey);
			if (existingMonth) {
				existingMonth.count += 1;
				continue;
			}

			months.set(event.monthKey, {
				monthKey: event.monthKey,
				label: formatMonthLabel(event.monthKey),
				count: 1,
			});
		}

		return Array.from(months.values());
	}, [filteredEvents]);

	const selectedMonthEvents = useMemo(() => {
		if (!selectedMonthKey) {
			return [];
		}

		return filteredEvents.filter((event) => event.monthKey === selectedMonthKey);
	}, [filteredEvents, selectedMonthKey]);

	const daySections = useMemo(() => {
		const sections = new Map<
			string,
			{
				dayKey: string;
				label: string;
				items: ReleaseCalendarEvent[];
			}
		>();

		for (const event of selectedMonthEvents) {
			const existingSection = sections.get(event.dayKey);
			if (existingSection) {
				existingSection.items.push(event);
				continue;
			}

			sections.set(event.dayKey, {
				dayKey: event.dayKey,
				label: formatDayLabel(event.dayKey, timezone),
				items: [event],
			});
		}

		return Array.from(sections.values());
	}, [selectedMonthEvents, timezone]);

	const watchingCount = releaseEvents.filter(
		(event) => event.source === "watching",
	).length;
	const watchlistCount = releaseEvents.filter(
		(event) => event.source === "watchlist",
	).length;
	const nextRelease = releaseEvents[0];
	const isInitialLoading = releaseCalendarQuery.isLoading;
	const isFetchingMore =
		releaseCalendarQuery.isFetching && !releaseCalendarQuery.isLoading;

	useEffect(() => {
		if (monthOptions.length === 0) {
			setSelectedMonthKey(null);
			return;
		}

		if (
			selectedMonthKey &&
			monthOptions.some((month) => month.monthKey === selectedMonthKey)
		) {
			return;
		}

		setSelectedMonthKey(monthOptions[0]?.monthKey ?? null);
	}, [monthOptions, selectedMonthKey]);

	if (!user) {
		return (
			<UnauthenticatedState
				title="Release Calendar"
				description="Sign in to see upcoming episodes and watchlist releases"
			/>
		);
	}

	if (isInitialLoading) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	if (releaseCalendarQuery.isError) {
		return (
			<M3Card variant="elevated" className="mx-auto max-w-xl text-center">
				<M3CardHeader>
					<Calendar
						className="mx-auto mb-4 h-16 w-16"
						style={{ color: "var(--md-sys-color-outline)" }}
					/>
					<M3CardTitle className="md-headline-small">
						Release calendar unavailable
					</M3CardTitle>
					<M3CardDescription>
						The upcoming release feed could not be loaded right now.
					</M3CardDescription>
				</M3CardHeader>
				<M3CardContent>
					<M3Button variant="filled-tonal" onClick={() => releaseCalendarQuery.refetch()}>
						Try again
					</M3Button>
				</M3CardContent>
			</M3Card>
		);
	}

	if (releaseEvents.length === 0) {
		return (
			<M3Card variant="elevated" className="mx-auto max-w-xl text-center">
				<M3CardHeader>
					<Calendar
						className="mx-auto mb-4 h-16 w-16"
						style={{ color: "var(--md-sys-color-outline)" }}
					/>
					<M3CardTitle className="md-headline-small">
						No upcoming releases yet
					</M3CardTitle>
					<M3CardDescription>
						When shows in your Up Next queue get new air dates or something in
						your watchlist has a future release date, it will appear here.
					</M3CardDescription>
				</M3CardHeader>
				<M3CardContent>
					<M3Button variant="filled" asChild>
						<Link to="/search" search={{ q: "", type: "all" }}>
							Find shows and movies
						</Link>
					</M3Button>
				</M3CardContent>
			</M3Card>
		);
	}

	return (
		<div className="space-y-6">
			<section
				className="relative overflow-hidden rounded-[32px] border p-5 md:p-6"
				style={{
					background:
						"linear-gradient(135deg, color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent), color-mix(in srgb, var(--md-sys-color-tertiary) 12%, transparent) 52%, var(--md-sys-color-surface-container-high))",
					borderColor: "var(--md-sys-color-outline-variant)",
				}}
			>
				<div className="relative flex flex-col gap-6">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div className="max-w-2xl">
							<div
								className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
								style={{
									backgroundColor:
										"color-mix(in srgb, var(--md-sys-color-surface) 72%, transparent)",
									borderColor: "var(--md-sys-color-outline-variant)",
								}}
							>
								<Calendar className="h-4 w-4" />
								<span className="md-label-large">Release Calendar</span>
							</div>
							<h1 className="md-headline-large mb-2">What lands next</h1>
							<p
								className="md-body-large max-w-xl"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								Upcoming episode drops from the shows you&apos;re actively
								watching, plus future-dated titles from your watchlist.
							</p>
						</div>

						<div
							className="min-w-0 rounded-[24px] border px-4 py-3"
							style={{
								backgroundColor:
									"color-mix(in srgb, var(--md-sys-color-surface) 82%, transparent)",
								borderColor: "var(--md-sys-color-outline-variant)",
							}}
						>
							<p
								className="mb-1 text-xs uppercase tracking-[0.18em]"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								Next release
							</p>
							<p className="md-title-large line-clamp-1">{nextRelease.title}</p>
							<p
								className="md-body-small line-clamp-2"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								{nextRelease.subtitle}
							</p>
							<p className="mt-2 text-sm font-semibold">
								{formatDateOnly(getDateFromDayKey(nextRelease.dayKey), timezone)}
							</p>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
						<StatCard
							icon={<Calendar className="h-4 w-4" />}
							label="Upcoming releases"
							value={String(releaseEvents.length)}
						/>
						<StatCard
							icon={<Tv className="h-4 w-4" />}
							label="Watching"
							value={String(watchingCount)}
						/>
						<StatCard
							icon={<List className="h-4 w-4" />}
							label="Watchlist"
							value={String(watchlistCount)}
						/>
					</div>
				</div>
			</section>

			<div className="flex flex-wrap items-center gap-2">
				<FilterButton
					isActive={sourceFilter === "all"}
					label="All releases"
					onClick={() => setSourceFilter("all")}
				/>
				<FilterButton
					isActive={sourceFilter === "watching"}
					label="Watching"
					onClick={() => setSourceFilter("watching")}
				/>
				<FilterButton
					isActive={sourceFilter === "watchlist"}
					label="Watchlist"
					onClick={() => setSourceFilter("watchlist")}
				/>
				{isFetchingMore && (
					<p
						className="ml-auto flex items-center gap-2 text-sm"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						<Loader2 className="h-4 w-4 animate-spin" />
						Refreshing calendar
					</p>
				)}
			</div>

			{filteredEvents.length === 0 && (
				<M3Card variant="elevated" className="mx-auto max-w-xl text-center">
					<M3CardHeader>
						{sourceFilter === "watching" ? (
							<Tv
								className="mx-auto mb-4 h-16 w-16"
								style={{ color: "var(--md-sys-color-outline)" }}
							/>
						) : (
							<List
								className="mx-auto mb-4 h-16 w-16"
								style={{ color: "var(--md-sys-color-outline)" }}
							/>
						)}
						<M3CardTitle className="md-headline-small">
							No {sourceFilter} releases in the calendar
						</M3CardTitle>
						<M3CardDescription>
							Try switching back to all releases to see everything currently on
							the schedule.
						</M3CardDescription>
					</M3CardHeader>
					<M3CardContent>
						<M3Button
							variant="filled-tonal"
							onClick={() => setSourceFilter("all")}
						>
							Show all releases
						</M3Button>
					</M3CardContent>
				</M3Card>
			)}

			{filteredEvents.length > 0 && (
				<div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
					<aside className="lg:sticky lg:top-24 lg:self-start">
						<div
							className="rounded-[28px] border p-3"
							style={{
								backgroundColor: "var(--md-sys-color-surface-container-low)",
								borderColor: "var(--md-sys-color-outline-variant)",
							}}
						>
							<div className="mb-3 px-2 pt-1">
								<p className="md-title-medium">Months</p>
								<p
									className="md-body-small"
									style={{ color: "var(--md-sys-color-on-surface-variant)" }}
								>
									{monthOptions.length} month
									{monthOptions.length !== 1 ? "s" : ""} with upcoming
									releases
								</p>
							</div>

							<div className="space-y-2">
								{monthOptions.map((month) => {
									const isActive = month.monthKey === selectedMonthKey;
									return (
										<button
											key={month.monthKey}
											type="button"
											onClick={() => setSelectedMonthKey(month.monthKey)}
											className="flex w-full items-center justify-between rounded-[22px] border px-3 py-3 text-left transition-colors"
											style={
												isActive
													? {
															backgroundColor:
																"var(--md-sys-color-primary-container)",
															borderColor: "var(--md-sys-color-primary)",
															color:
																"var(--md-sys-color-on-primary-container)",
														}
													: {
															backgroundColor:
																"var(--md-sys-color-surface-container-highest)",
															borderColor:
																"var(--md-sys-color-outline-variant)",
														}
											}
										>
											<div>
												<p className="font-semibold">{month.label}</p>
												<p
													className="text-sm"
													style={{
														color: isActive
															? "var(--md-sys-color-on-primary-container)"
															: "var(--md-sys-color-on-surface-variant)",
													}}
												>
													{month.count} release
													{month.count !== 1 ? "s" : ""}
												</p>
											</div>
											<span className="text-xs font-semibold uppercase tracking-[0.14em]">
												{month.monthKey.slice(5)}
											</span>
										</button>
									);
								})}
							</div>
						</div>
					</aside>

					<div className="space-y-5">
						{daySections.map((section) => (
							<section
								key={section.dayKey}
								className="rounded-[28px] border p-4 md:p-5"
								style={{
									backgroundColor: "var(--md-sys-color-surface-container-low)",
									borderColor: "var(--md-sys-color-outline-variant)",
								}}
							>
								<div className="mb-4 flex flex-col gap-2 rounded-[22px] border px-4 py-3 md:flex-row md:items-end md:justify-between">
									<div>
										<p className="md-title-large">{section.label}</p>
										<p
											className="md-body-small"
											style={{
												color: "var(--md-sys-color-on-surface-variant)",
											}}
										>
											{section.items.length} release
											{section.items.length !== 1 ? "s" : ""}
										</p>
									</div>
									<p
										className="text-xs font-semibold uppercase tracking-[0.18em]"
										style={{
											color: "var(--md-sys-color-on-surface-variant)",
										}}
									>
										{section.dayKey}
									</p>
								</div>

								<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
									{section.items.map((event) => (
										<ReleaseEventCard key={event.id} event={event} />
									))}
								</div>
							</section>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function StatCard({
	icon,
	label,
	value,
}: {
	icon: ReactNode;
	label: string;
	value: string;
}) {
	return (
		<div
			className="rounded-[24px] border p-4"
			style={{
				backgroundColor:
					"color-mix(in srgb, var(--md-sys-color-surface) 82%, transparent)",
				borderColor: "var(--md-sys-color-outline-variant)",
			}}
		>
			<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
				{icon}
			</div>
			<p
				className="text-sm"
				style={{ color: "var(--md-sys-color-on-surface-variant)" }}
			>
				{label}
			</p>
			<p className="md-headline-small">{value}</p>
		</div>
	);
}

function FilterButton({
	isActive,
	label,
	onClick,
}: {
	isActive: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<M3Button
			variant={isActive ? "filled-tonal" : "text"}
			className="rounded-full px-5"
			onClick={onClick}
		>
			{label}
		</M3Button>
	);
}

function ReleaseEventCard({ event }: { event: ReleaseCalendarEvent }) {
	const posterUrl = getTmdbPosterUrl(event.posterPath ?? null);
	const sourceLabel = event.source === "watching" ? "Watching" : "Watchlist";
	const accentColor =
		event.source === "watching"
			? "var(--md-sys-color-primary)"
			: "var(--md-sys-color-tertiary)";
	const accentBackground =
		event.source === "watching"
			? "color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent)"
			: "color-mix(in srgb, var(--md-sys-color-tertiary) 16%, transparent)";

	return (
		<Link to={event.to as never} params={event.params as never} className="block">
			<div
				className="group flex h-full gap-3 rounded-[24px] border p-3 transition-transform hover:-translate-y-0.5"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container-highest)",
					borderColor: "var(--md-sys-color-outline-variant)",
					boxShadow: `inset 4px 0 0 ${accentColor}`,
				}}
			>
				<div
					className="relative h-24 w-16 shrink-0 overflow-hidden rounded-[18px]"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container-high)",
					}}
				>
					{posterUrl ? (
						<img
							src={posterUrl}
							alt={event.title}
							className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
						/>
					) : (
						<div
							className="flex h-full w-full items-center justify-center"
							style={{ color: "var(--md-sys-color-outline)" }}
						>
							<Film className="h-5 w-5" />
						</div>
					)}
				</div>

				<div className="min-w-0 flex-1">
					<div className="mb-2 flex flex-wrap items-center gap-2">
						<span
							className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
							style={{
								backgroundColor: accentBackground,
								color: accentColor,
							}}
						>
							{sourceLabel}
						</span>
						<span
							className="text-[11px] font-semibold uppercase tracking-[0.12em]"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							{event.kind}
						</span>
					</div>

					<h3 className="md-title-medium line-clamp-2">{event.title}</h3>
					<p
						className="mt-1 text-sm"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{event.subtitle}
					</p>
					{event.description && (
						<p
							className="mt-2 line-clamp-2 text-sm"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							{event.description}
						</p>
					)}
				</div>
			</div>
		</Link>
	);
}

function buildReleaseCalendarEvents({
	timezone,
	items,
}: {
	timezone: string;
	items: ApiReleaseCalendarItem[];
}) {
	const todayKey = getDayKeyInTimezone(new Date(), timezone);
	const dedupe = new Set<string>();
	const events: ReleaseCalendarEvent[] = [];

	for (const item of items) {
		if (!item.releaseDate) {
			continue;
		}

		const dayKey = getDayKeyInTimezone(
			parseCalendarDateValue(item.releaseDate),
			timezone,
		);
		if (dayKey < todayKey) {
			continue;
		}

		const dedupeKey = `${item.source}:${item.mediaType}:${item.movieId ?? item.showId ?? item.title}:${item.seasonNumber ?? ""}:${item.episodeNumber ?? ""}:${dayKey}`;
		const link = getReleaseCalendarLink(item);
		if (!link || dedupe.has(dedupeKey)) {
			continue;
		}
		dedupe.add(dedupeKey);

		events.push({
			id: dedupeKey,
			dayKey,
			monthKey: dayKey.slice(0, 7),
			source: item.source,
			kind:
				item.releaseKind === "episode"
					? "episode"
					: item.releaseKind === "movie"
						? "movie"
						: "show",
			title: item.title,
			subtitle: item.subtitle ?? "",
			description: item.overview,
			posterPath: item.posterPath,
			to: link.to,
			params: link.params,
		});
	}

	return events.sort((left, right) => {
		if (left.dayKey !== right.dayKey) {
			return left.dayKey.localeCompare(right.dayKey);
		}

		return left.title.localeCompare(right.title);
	});
}

function getReleaseCalendarLink(item: ApiReleaseCalendarItem) {
	const titleSlug = createTitleSlug(item.title);

	if (item.mediaType === "movie" && item.movieId) {
		return {
			to: "/movies/$movieId/$title",
			params: {
				movieId: item.movieId,
				title: titleSlug,
			},
		};
	}

	if (
		item.mediaType === "show" &&
		item.showId &&
		typeof item.seasonNumber === "number" &&
		typeof item.episodeNumber === "number"
	) {
		return {
			to: "/shows/$showId/$title/seasons/$seasonNumber/episodes/$episodeNumber",
			params: {
				showId: item.showId,
				title: titleSlug,
				seasonNumber: String(item.seasonNumber),
				episodeNumber: String(item.episodeNumber),
			},
		};
	}

	if (item.mediaType === "show" && item.showId) {
		return {
			to: "/shows/$showId/$title",
			params: {
				showId: item.showId,
				title: titleSlug,
			},
		};
	}

	return null;
}

function parseCalendarDateValue(value: string) {
	if (DATE_ONLY_PATTERN.test(value)) {
		return new Date(`${value}T12:00:00Z`);
	}

	return new Date(value);
}

function getDateFromDayKey(dayKey: string) {
	const [year, month, day] = dayKey.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function formatMonthLabel(monthKey: string) {
	const [year, month] = monthKey.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)).toLocaleDateString(
		"en-US",
		{
			month: "long",
			year: "numeric",
			timeZone: "UTC",
		},
	);
}

function formatDayLabel(dayKey: string, timezone: string) {
	return formatDateOnly(getDateFromDayKey(dayKey), timezone);
}
