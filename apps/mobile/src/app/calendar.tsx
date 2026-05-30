import type { ReleaseCalendarItemDto } from "@opnshelf/api";
import { Stack } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ReleaseRow } from "@/components/calendar/ReleaseRow";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useReleaseCalendar } from "@/lib/use-release-calendar";

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

export default function CalendarScreen() {
	const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

	// Fetch a window around the visible week so adjacent navigation is instant.
	const startDate = dateKey(addDays(weekStart, -7));
	const endDate = dateKey(addDays(weekStart, 13));
	const { data, isLoading, isError } = useReleaseCalendar(startDate, endDate);

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

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ headerShown: true, title: "Calendar" }} />

			<View className="flex-row items-center justify-between border-border border-b px-4 py-3">
				<Pressable
					hitSlop={8}
					onPress={() => setWeekStart((w) => addDays(w, -7))}
					className="h-10 w-10 items-center justify-center rounded-lg border border-border"
				>
					<ChevronLeft color="#94a3b8" size={20} />
				</Pressable>
				<Pressable onPress={() => setWeekStart(getWeekStart(new Date()))}>
					<Text className="font-display font-semibold text-base text-foreground">
						{formatRange(weekStart)}
					</Text>
					<Text className="text-center text-muted-foreground text-xs">
						Tap for today
					</Text>
				</Pressable>
				<Pressable
					hitSlop={8}
					onPress={() => setWeekStart((w) => addDays(w, 7))}
					className="h-10 w-10 items-center justify-center rounded-lg border border-border"
				>
					<ChevronRight color="#94a3b8" size={20} />
				</Pressable>
			</View>

			{isLoading ? (
				<LoadingState label="Loading calendar…" />
			) : isError ? (
				<ErrorState message="Couldn't load the release calendar. Try again." />
			) : (
				<ScrollView
					className="flex-1"
					contentContainerClassName="gap-5 px-4 py-4 pb-12"
					showsVerticalScrollIndicator={false}
				>
					{days.map((day) => (
						<View key={day.key} className="gap-2">
							<Text
								className={
									isSameDay(day.date, new Date())
										? "font-display font-semibold text-base text-primary"
										: "font-display font-semibold text-base text-foreground"
								}
							>
								{formatDayLabel(day.date)}
							</Text>
							{day.releases.length === 0 ? (
								<Text className="text-muted-foreground text-sm">
									No releases
								</Text>
							) : (
								<View className="gap-2">
									{day.releases.map((release) => (
										<ReleaseRow
											key={`${release.releaseKind}-${release.movieId ?? release.showId}-${release.seasonNumber ?? ""}-${release.episodeNumber ?? ""}-${release.releaseDate}`}
											item={release}
										/>
									))}
								</View>
							)}
						</View>
					))}
				</ScrollView>
			)}
		</View>
	);
}
