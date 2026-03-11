import {
	authControllerMeOptions,
	type ReleaseCalendarItemDto,
	showsControllerGetUserReleaseCalendarOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Calendar, ChevronLeft, ChevronRight, Film, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { useProfileRouteState } from "@/hooks/useProfileRouteState";
import { useUserSettings } from "@/hooks/useUserSettings";
import { getProfileRoute, isOwnerProfile } from "@/lib/profile-routes";
import {
	createTitleSlug,
	formatDateOnly,
	getDayKeyInTimezone,
	getTmdbPosterUrl,
} from "@/lib/utils";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ReleaseSource = "watching" | "watchlist";
type ReleaseKind = "episode" | "movie" | "show" | "season";

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
	seasonNumber?: number;
	episodeNumber?: number;
	to: string;
	params: Record<string, string>;
};

type ReleaseCalendarLink = {
	to: string;
	params: Record<string, string>;
};

type CalendarDayCell = {
	dayKey: string;
	dayNumber: string;
	isCurrentMonth: boolean;
	isToday: boolean;
	items: ReleaseCalendarEvent[];
};

type CalendarMonthView = {
	monthLabel: string;
	weekdayLabels: string[];
	weeks: CalendarDayCell[][];
};

export const Route = createFileRoute("/profile/$handle/calendar")({
	beforeLoad: async ({ context, params }) => {
		const handle = params.handle.trim().replace(/^@/, "").toLowerCase();
		const [currentUser, profile] = await Promise.all([
			context.queryClient
				.ensureQueryData({
					...authControllerMeOptions(),
					staleTime: 5 * 60 * 1000,
					retry: false,
				})
				.catch(() => null),
			context.queryClient
				.ensureQueryData({
					...usersControllerGetPublicProfileOptions({
						path: { handle },
					}),
					retry: false,
				})
				.catch(() => null),
		]);

		if (!profile || !isOwnerProfile(currentUser?.did, profile.did)) {
			throw redirect({
				...getProfileRoute(handle, "shelf", { page: 1 }),
			});
		}
	},
	head: ({ params }) => ({
		meta: [
			{ title: `@${params.handle.replace(/^@/, "")} Calendar | OpnShelf` },
		],
	}),
	component: ProfileCalendarPage,
});

function ProfileCalendarPage() {
	const { handle } = Route.useParams();
	const { profile } = useProfileRouteState(handle);
	const { timezone } = useUserSettings();
	const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
	const userDid = profile?.did ?? "";

	const releaseCalendarQuery = useQuery({
		...showsControllerGetUserReleaseCalendarOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});

	const releaseEvents = useMemo(() => {
		return buildReleaseCalendarEvents({
			timezone,
			items: releaseCalendarQuery.data?.items ?? [],
		});
	}, [timezone, releaseCalendarQuery.data?.items]);
	const todayKey = useMemo(
		() => getDayKeyInTimezone(new Date(), timezone),
		[timezone],
	);
	const currentMonthKey = useMemo(() => todayKey.slice(0, 7), [todayKey]);

	const isInitialLoading = releaseCalendarQuery.isLoading;
	const isFetchingMore =
		releaseCalendarQuery.isFetching && !releaseCalendarQuery.isLoading;

	const selectedMonthEvents = useMemo(() => {
		const monthKey = selectedMonthKey ?? currentMonthKey;
		return releaseEvents.filter((event) => event.monthKey === monthKey);
	}, [currentMonthKey, releaseEvents, selectedMonthKey]);

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

	const selectedMonthView = useMemo(() => {
		const monthKey = selectedMonthKey ?? currentMonthKey;

		return buildCalendarMonthView({
			monthKey,
			items: selectedMonthEvents,
			todayKey,
		});
	}, [currentMonthKey, selectedMonthEvents, selectedMonthKey, todayKey]);
	const canGoToPreviousMonth =
		(selectedMonthKey ?? currentMonthKey) > currentMonthKey;

	useEffect(() => {
		if (!selectedMonthKey) {
			setSelectedMonthKey(currentMonthKey);
		}
	}, [currentMonthKey, selectedMonthKey]);

	if (!profile) {
		return null;
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
					<M3Button
						variant="filled-tonal"
						onClick={() => releaseCalendarQuery.refetch()}
					>
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
			<div className="flex justify-end">
				{isFetchingMore && (
					<p
						className="flex items-center gap-2 text-sm"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						<Loader2 className="h-4 w-4 animate-spin" />
						Refreshing calendar
					</p>
				)}
			</div>

			{releaseEvents.length > 0 && (
				<div className="space-y-5">
					<div className="space-y-5">
						{selectedMonthView ? (
							<section
								className="overflow-hidden rounded-[30px] border"
								style={{
									backgroundColor: "var(--md-sys-color-surface-container-low)",
									borderColor: "var(--md-sys-color-outline-variant)",
								}}
							>
								<div
									className="flex items-center justify-between gap-4 border-b px-6 py-5"
									style={{
										background:
											"linear-gradient(135deg, color-mix(in srgb, var(--md-sys-color-primary) 12%, var(--md-sys-color-surface-container-low)) 0%, var(--md-sys-color-surface-container-low) 72%)",
										borderColor: "var(--md-sys-color-outline-variant)",
									}}
								>
									<div>
										<p className="md-title-large">
											{selectedMonthView.monthLabel}
										</p>
										<p
											className="md-body-small"
											style={{
												color: "var(--md-sys-color-on-surface-variant)",
											}}
										>
											{selectedMonthEvents.length} upcoming release
											{selectedMonthEvents.length !== 1 ? "s" : ""}
										</p>
									</div>
									<div className="flex items-center gap-2">
										<M3Button
											variant="text"
											className="min-w-0 rounded-full px-3"
											aria-label="Previous month"
											onClick={() =>
												canGoToPreviousMonth &&
												setSelectedMonthKey(
													getAdjacentMonthKey(
														selectedMonthKey ?? currentMonthKey,
														-1,
													),
												)
											}
											disabled={!canGoToPreviousMonth}
										>
											<ChevronLeft className="h-4 w-4" />
										</M3Button>
										<M3Button
											variant="text"
											className="min-w-0 rounded-full px-3"
											aria-label="Next month"
											onClick={() =>
												setSelectedMonthKey(
													getAdjacentMonthKey(
														selectedMonthKey ?? currentMonthKey,
														1,
													),
												)
											}
										>
											<ChevronRight className="h-4 w-4" />
										</M3Button>
									</div>
								</div>

								<div
									className="hidden grid-cols-7 border-b lg:grid"
									style={{
										backgroundColor:
											"var(--md-sys-color-surface-container-high)",
										borderColor: "var(--md-sys-color-outline-variant)",
									}}
								>
									{selectedMonthView.weekdayLabels.map((label) => (
										<div
											key={label}
											className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em]"
											style={{
												color: "var(--md-sys-color-on-surface-variant)",
											}}
										>
											{label}
										</div>
									))}
								</div>

								<div className="hidden divide-y divide-(--md-sys-color-outline-variant) lg:block">
									{selectedMonthView.weeks.map((week) => (
										<div key={week[0]?.dayKey} className="grid grid-cols-7">
											{week.map((day) => (
												<div
													key={day.dayKey}
													className="min-h-[184px] border-r p-3 last:border-r-0"
													style={{
														backgroundColor: day.isCurrentMonth
															? "var(--md-sys-color-surface-container-low)"
															: "color-mix(in srgb, var(--md-sys-color-surface-container-low) 78%, var(--md-sys-color-surface) 22%)",
														borderColor: "var(--md-sys-color-outline-variant)",
													}}
												>
													<div className="mb-3 flex items-center justify-between gap-2">
														<span
															className="inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold"
															style={
																day.isToday
																	? {
																			backgroundColor:
																				"var(--md-sys-color-primary)",
																			color: "var(--md-sys-color-on-primary)",
																		}
																	: {
																			backgroundColor:
																				day.items.length > 0
																					? "var(--md-sys-color-secondary-container)"
																					: "transparent",
																			color: day.isCurrentMonth
																				? "var(--md-sys-color-on-surface)"
																				: "var(--md-sys-color-on-surface-variant)",
																		}
															}
														>
															{day.dayNumber}
														</span>
													</div>

													<div className="space-y-2">
														{day.items.slice(0, 3).map((event) => (
															<CalendarEventPill key={event.id} event={event} />
														))}
														{day.items.length > 3 && (
															<p
																className="px-1 text-xs font-medium"
																style={{
																	color:
																		"var(--md-sys-color-on-surface-variant)",
																}}
															>
																+{day.items.length - 3} more release
																{day.items.length - 3 !== 1 ? "s" : ""}
															</p>
														)}
													</div>
												</div>
											))}
										</div>
									))}
								</div>
							</section>
						) : null}

						<div className="space-y-5 lg:hidden">
							{selectedMonthEvents.length === 0 && selectedMonthView ? (
								<div
									className="rounded-[24px] border px-4 py-5"
									style={{
										backgroundColor:
											"var(--md-sys-color-surface-container-low)",
										borderColor: "var(--md-sys-color-outline-variant)",
										color: "var(--md-sys-color-on-surface-variant)",
									}}
								>
									No releases scheduled this month.
								</div>
							) : null}
							{daySections.map((section) => (
								<section
									key={section.dayKey}
									className="rounded-[28px] border p-4 md:p-5"
									style={{
										backgroundColor:
											"var(--md-sys-color-surface-container-low)",
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
				</div>
			)}
		</div>
	);
}

function ReleaseEventCard({ event }: { event: ReleaseCalendarEvent }) {
	const posterUrl = getTmdbPosterUrl(event.posterPath ?? null);
	const { accentBackground, accentColor, sourceLabel } =
		getReleaseSourcePresentation(event.source);

	return (
		<Link
			to={event.to as never}
			params={event.params as never}
			className="block"
		>
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

function CalendarEventPill({ event }: { event: ReleaseCalendarEvent }) {
	const { accentColor } = getReleaseSourcePresentation(event.source);
	const episodeLabel = getCalendarEventEpisodeLabel(event);

	return (
		<Link
			to={event.to as never}
			params={event.params as never}
			className="block rounded-[18px] border px-3 py-3 transition-transform hover:-translate-y-0.5"
			style={{
				backgroundColor: "var(--md-sys-color-surface-container-highest)",
				borderColor: "var(--md-sys-color-outline-variant)",
				boxShadow: `inset 3px 0 0 ${accentColor}`,
			}}
		>
			<div className="min-w-0">
				<p className="text-[15px] font-semibold leading-5">{event.title}</p>
				<p
					className="mt-1 text-[14px] font-medium leading-5"
					style={{ color: "var(--md-sys-color-on-surface-variant)" }}
				>
					{episodeLabel}
				</p>
			</div>
		</Link>
	);
}

function buildReleaseCalendarEvents({
	timezone,
	items,
}: {
	timezone: string;
	items: ReleaseCalendarItemDto[];
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
			seasonNumber: item.seasonNumber,
			episodeNumber: item.episodeNumber,
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

function getReleaseCalendarLink(
	item: ReleaseCalendarItemDto,
): ReleaseCalendarLink | null {
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

function buildCalendarMonthView({
	monthKey,
	items,
	todayKey,
}: {
	monthKey: string;
	items: ReleaseCalendarEvent[];
	todayKey: string;
}): CalendarMonthView {
	const monthStart = getDateFromMonthKey(monthKey);
	const monthEnd = new Date(monthStart);
	monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
	const monthStartWeekday = getMondayBasedWeekdayIndex(monthStart);
	const monthEndWeekday = getMondayBasedWeekdayIndex(monthEnd);

	const start = new Date(monthStart);
	start.setUTCDate(start.getUTCDate() - monthStartWeekday);

	const end = new Date(monthEnd);
	end.setUTCDate(end.getUTCDate() + (6 - monthEndWeekday));

	const itemsByDay = new Map<string, ReleaseCalendarEvent[]>();
	for (const item of items) {
		const existingItems = itemsByDay.get(item.dayKey);
		if (existingItems) {
			existingItems.push(item);
			continue;
		}

		itemsByDay.set(item.dayKey, [item]);
	}

	const weekdayLabels = Array.from({ length: 7 }, (_, index) => {
		const day = new Date(Date.UTC(2026, 0, 5 + index, 12, 0, 0));
		return day.toLocaleDateString("en-US", {
			weekday: "short",
			timeZone: "UTC",
		});
	});

	const weeks: CalendarDayCell[][] = [];
	const cursor = new Date(start);

	while (cursor <= end) {
		const week: CalendarDayCell[] = [];

		for (let index = 0; index < 7; index += 1) {
			const dayKey = getUtcDayKey(cursor);
			week.push({
				dayKey,
				dayNumber: String(cursor.getUTCDate()),
				isCurrentMonth: dayKey.startsWith(monthKey),
				isToday: dayKey === todayKey,
				items: itemsByDay.get(dayKey) ?? [],
			});
			cursor.setUTCDate(cursor.getUTCDate() + 1);
		}

		weeks.push(week);
	}

	return {
		monthLabel: formatMonthLabel(monthKey),
		weekdayLabels,
		weeks,
	};
}

function getDateFromMonthKey(monthKey: string) {
	const [year, month] = monthKey.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
}

function getUtcDayKey(date: Date) {
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function getUtcMonthKey(date: Date) {
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getAdjacentMonthKey(monthKey: string, offset: number) {
	const date = getDateFromMonthKey(monthKey);
	date.setUTCMonth(date.getUTCMonth() + offset, 1);
	return getUtcMonthKey(date);
}

function getMondayBasedWeekdayIndex(date: Date) {
	return (date.getUTCDay() + 6) % 7;
}

function getReleaseSourcePresentation(source: ReleaseSource) {
	return {
		sourceLabel: source === "watching" ? "Watching" : "Watchlist",
		accentColor:
			source === "watching"
				? "var(--md-sys-color-primary)"
				: "var(--md-sys-color-tertiary)",
		accentBackground:
			source === "watching"
				? "color-mix(in srgb, var(--md-sys-color-primary) 16%, transparent)"
				: "color-mix(in srgb, var(--md-sys-color-tertiary) 16%, transparent)",
	};
}

function getCalendarEventEpisodeLabel(event: ReleaseCalendarEvent) {
	if (
		typeof event.seasonNumber === "number" &&
		typeof event.episodeNumber === "number"
	) {
		return `S${event.seasonNumber} E${event.episodeNumber}`;
	}

	if (event.kind === "episode" && event.subtitle) {
		return event.subtitle.split(" · ")[0] ?? event.subtitle;
	}

	return "S? E?";
}
