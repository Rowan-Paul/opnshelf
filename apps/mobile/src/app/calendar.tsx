import type { ReleaseCalendarItemDto } from "@opnshelf/api";
import { Stack } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { CalendarMonth } from "@/components/calendar/CalendarMonth";
import { ReleaseRow } from "@/components/calendar/ReleaseRow";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useReleaseCalendar } from "@/lib/use-release-calendar";

type CalendarView = "week" | "month";

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/** Monday-anchored start of the week containing `date`, at local midnight. */
function getWeekStart(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay();
	const diff = day === 0 ? 6 : day - 1; // Monday = 0
	d.setDate(d.getDate() - diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

function addDays(date: Date, n: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + n);
	return d;
}

/** First day of the month containing `date`, at local midnight. */
function getMonthStart(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Local YYYY-MM-DD key, matching the calendar item's date prefix. */
function dateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
	return dateKey(a) === dateKey(b);
}

function formatRange(weekStart: Date): string {
	const end = addDays(weekStart, 6);
	const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
	return `${weekStart.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function formatDayLabel(date: Date): string {
	if (isSameDay(date, new Date())) return "Today";
	return date.toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

function releaseRowKey(release: ReleaseCalendarItemDto): string {
	return `${release.releaseKind}-${release.movieId ?? release.showId}-${release.seasonNumber ?? ""}-${release.episodeNumber ?? ""}-${release.releaseDate}`;
}

export default function CalendarScreen() {
	const [view, setView] = useState<CalendarView>("week");
	const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
	const [monthStart, setMonthStart] = useState(() => getMonthStart(new Date()));
	const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

	// Fetch a window that covers the visible range plus padding so adjacent
	// navigation is instant. Week view needs a fortnight; month view fetches the
	// surrounding months (matching the web calendar's 3-month window).
	const { startDate, endDate } = useMemo(() => {
		if (view === "month") {
			const start = new Date(
				monthStart.getFullYear(),
				monthStart.getMonth() - 1,
				1,
			);
			const end = new Date(
				monthStart.getFullYear(),
				monthStart.getMonth() + 2,
				0,
			);
			return { startDate: dateKey(start), endDate: dateKey(end) };
		}
		return {
			startDate: dateKey(addDays(weekStart, -7)),
			endDate: dateKey(addDays(weekStart, 13)),
		};
	}, [view, weekStart, monthStart]);

	const { data, isLoading, isError, isRefetching, refetch } =
		useReleaseCalendar(startDate, endDate);

	const refreshControl = (
		<RefreshControl
			refreshing={isRefetching}
			onRefresh={() => {
				void refetch();
			}}
			tintColor="#f3bc00"
			colors={["#f3bc00"]}
		/>
	);

	const byDate = useMemo(() => {
		const map = new Map<string, ReleaseCalendarItemDto[]>();
		for (const item of data?.items ?? []) {
			const key = item.releaseDate.split("T")[0];
			const list = map.get(key);
			if (list) list.push(item);
			else map.set(key, [item]);
		}
		return map;
	}, [data]);

	const days = useMemo(
		() =>
			Array.from({ length: 7 }, (_, i) => {
				const date = addDays(weekStart, i);
				return {
					date,
					key: dateKey(date),
					releases: byDate.get(dateKey(date)) ?? [],
				};
			}),
		[weekStart, byDate],
	);

	const selectedDayReleases = selectedDayKey
		? (byDate.get(selectedDayKey) ?? [])
		: [];

	const goToToday = () => {
		const now = new Date();
		setWeekStart(getWeekStart(now));
		setMonthStart(getMonthStart(now));
		setSelectedDayKey(null);
	};

	const stepMonth = (delta: number) => {
		setMonthStart((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
		setSelectedDayKey(null);
	};

	const headerTitle =
		view === "month"
			? `${MONTH_NAMES[monthStart.getMonth()]} ${monthStart.getFullYear()}`
			: formatRange(weekStart);

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ headerShown: true, title: "Calendar" }} />

			<View className="flex-row items-center justify-center gap-2 border-border border-b px-4 pt-3">
				{(["week", "month"] as const).map((v) => {
					const active = view === v;
					return (
						<Pressable
							key={v}
							onPress={() => setView(v)}
							className={
								active
									? "rounded-full bg-primary px-4 py-1.5"
									: "rounded-full bg-background-subtle px-4 py-1.5"
							}
						>
							<Text
								className={
									active
										? "font-medium text-primary-foreground text-sm capitalize"
										: "font-medium text-muted-foreground text-sm capitalize"
								}
							>
								{v}
							</Text>
						</Pressable>
					);
				})}
			</View>

			<View className="flex-row items-center justify-between border-border border-b px-4 py-3">
				<Pressable
					hitSlop={8}
					onPress={() =>
						view === "month"
							? stepMonth(-1)
							: setWeekStart((w) => addDays(w, -7))
					}
					className="h-10 w-10 items-center justify-center rounded-lg border border-border"
				>
					<ChevronLeft color="#94a3b8" size={20} />
				</Pressable>
				<Pressable onPress={goToToday}>
					<Text className="text-center font-display font-semibold text-base text-foreground">
						{headerTitle}
					</Text>
					<Text className="text-center text-muted-foreground text-xs">
						Tap for today
					</Text>
				</Pressable>
				<Pressable
					hitSlop={8}
					onPress={() =>
						view === "month" ? stepMonth(1) : setWeekStart((w) => addDays(w, 7))
					}
					className="h-10 w-10 items-center justify-center rounded-lg border border-border"
				>
					<ChevronRight color="#94a3b8" size={20} />
				</Pressable>
			</View>

			{isLoading ? (
				<LoadingState label="Loading calendar…" />
			) : isError ? (
				<ErrorState message="Couldn't load the release calendar. Try again." />
			) : view === "month" ? (
				<ScrollView
					className="flex-1"
					contentContainerClassName="gap-4 px-4 py-4 pb-12"
					showsVerticalScrollIndicator={false}
					refreshControl={refreshControl}
				>
					<CalendarMonth
						monthDate={monthStart}
						byDate={byDate}
						selectedKey={selectedDayKey}
						onSelectDay={setSelectedDayKey}
					/>

					<View className="gap-2">
						<Text className="font-display font-semibold text-base text-foreground">
							{selectedDayKey
								? formatDayLabel(new Date(`${selectedDayKey}T00:00:00`))
								: "Releases"}
						</Text>
						{!selectedDayKey ? (
							<Text className="text-muted-foreground text-sm">
								Tap a day with releases to see what's coming out.
							</Text>
						) : selectedDayReleases.length === 0 ? (
							<Text className="text-muted-foreground text-sm">No releases</Text>
						) : (
							<View className="gap-2">
								{selectedDayReleases.map((release) => (
									<ReleaseRow key={releaseRowKey(release)} item={release} />
								))}
							</View>
						)}
					</View>
				</ScrollView>
			) : (
				<ScrollView
					className="flex-1"
					contentContainerClassName="gap-3 px-4 py-4 pb-12"
					showsVerticalScrollIndicator={false}
					refreshControl={refreshControl}
				>
					{days.map((day) => {
						const isToday = isSameDay(day.date, new Date());
						// Empty days collapse to one quiet row so the days that actually
						// have releases stand out instead of drowning in "No releases".
						if (day.releases.length === 0) {
							return (
								<View
									key={day.key}
									className="flex-row items-center justify-between"
								>
									<Text
										className={
											isToday
												? "font-display font-medium text-primary text-sm"
												: "font-display font-medium text-muted-foreground text-sm"
										}
									>
										{formatDayLabel(day.date)}
									</Text>
									<Text className="text-muted-foreground text-xs">
										No releases
									</Text>
								</View>
							);
						}
						return (
							<View key={day.key} className="gap-2 pt-1">
								<Text
									className={
										isToday
											? "font-display font-semibold text-base text-primary"
											: "font-display font-semibold text-base text-foreground"
									}
								>
									{formatDayLabel(day.date)}
								</Text>
								<View className="gap-2">
									{day.releases.map((release) => (
										<ReleaseRow key={releaseRowKey(release)} item={release} />
									))}
								</View>
							</View>
						);
					})}
				</ScrollView>
			)}
		</View>
	);
}
