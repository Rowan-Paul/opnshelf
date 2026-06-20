import { Link } from "expo-router";
import { CalendarDays, Clock } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { ReleaseRow } from "@/components/calendar/ReleaseRow";
import { SectionHeader } from "@/components/home/SectionHeader";
import { Text } from "@/components/ui/text";
import { useReleaseCalendar } from "@/lib/use-release-calendar";

/** Format a Date as a UTC `YYYY-MM-DD` calendar day for the calendar range. */
function toIsoDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/**
 * "Upcoming" releases for the next ~two weeks across the user's tracked
 * shows/watchlist. Mirrors the web dashboard sidebar, reading from the same
 * `showsControllerGetUserReleaseCalendar` procedure (via `useReleaseCalendar`)
 * and capping the window at 14 days / 10 items. The header links into the
 * full calendar screen.
 */
export function UpcomingReleases() {
	const today = new Date();
	const twoWeeks = new Date(today);
	twoWeeks.setDate(today.getDate() + 14);

	const { data, isLoading, isError } = useReleaseCalendar(
		toIsoDay(today),
		toIsoDay(twoWeeks),
	);

	const releases = (data?.items ?? [])
		.slice()
		.sort(
			(a, b) =>
				new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime(),
		)
		.slice(0, 10);

	return (
		<View>
			<SectionHeader
				icon={CalendarDays}
				title="Upcoming"
				right={
					<Link href="/calendar" asChild>
						<Pressable
							hitSlop={8}
							className="flex-row items-center gap-1.5 rounded-lg border border-border px-3 py-1.5"
						>
							<CalendarDays color="#94a3b8" size={16} />
							<Text className="font-medium text-foreground text-sm">
								Calendar
							</Text>
						</Pressable>
					</Link>
				}
			/>

			{isLoading ? (
				<View className="gap-3">
					{[0, 1, 2].map((i) => (
						<View
							key={i}
							className="h-24 rounded-xl border border-border bg-card"
						/>
					))}
				</View>
			) : isError ? (
				<EmptyCard icon text="Couldn't load upcoming releases." />
			) : releases.length === 0 ? (
				<EmptyCard
					icon
					text="No upcoming releases. Track shows and movies to see their release dates here."
				/>
			) : (
				<View className="gap-3">
					{releases.map((item) => (
						<ReleaseRow
							key={`${item.showId || item.movieId || item.title}-${item.releaseDate}-${item.seasonNumber ?? ""}-${item.episodeNumber ?? ""}`}
							item={item}
						/>
					))}
				</View>
			)}
		</View>
	);
}

function EmptyCard({ text, icon }: { text: string; icon?: boolean }) {
	return (
		<View className="items-center gap-2 rounded-xl border border-border bg-card p-6">
			{icon ? <Clock color="#94a3b8" size={28} /> : null}
			<Text className="text-center text-muted-foreground text-sm">{text}</Text>
		</View>
	);
}
