import type { ReleaseCalendarItemDto } from "@opnshelf/api";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

type DayCell = {
	day: number;
	key: string;
	releases: ReleaseCalendarItemDto[];
	isToday: boolean;
} | null; // null = leading/trailing placeholder

function DayCellView({
	cell,
	selectedKey,
	onSelectDay,
}: {
	cell: DayCell;
	selectedKey: string | null;
	onSelectDay: (key: string) => void;
}) {
	if (!cell) {
		// Leading / trailing blank to keep the 7-column grid aligned.
		return (
			<View className="h-16 flex-1 p-0.5">
				<View className="flex-1 rounded-lg bg-background-subtle/40" />
			</View>
		);
	}

	const count = cell.releases.length;
	const isSelected = selectedKey === cell.key;
	const isMovie = cell.releases.some((r) => r.mediaType === "movie");
	const isShow = cell.releases.some((r) => r.mediaType === "show");
	const highlighted = isSelected || cell.isToday;

	return (
		<View className="h-16 flex-1 p-0.5">
			<Pressable
				disabled={count === 0}
				onPress={() => onSelectDay(cell.key)}
				className={
					highlighted
						? "flex-1 justify-between rounded-lg border border-primary bg-accent-subtle p-1"
						: "flex-1 justify-between rounded-lg border border-border bg-card p-1"
				}
			>
				<Text
					className={
						cell.isToday
							? "font-semibold text-primary text-xs"
							: "font-medium text-foreground text-xs"
					}
				>
					{cell.day}
				</Text>

				{count > 0 ? (
					<View className="flex-row items-center gap-1 pb-0.5">
						{isMovie ? (
							<View className="h-1.5 w-1.5 rounded-full bg-blue-500" />
						) : null}
						{isShow ? (
							<View className="h-1.5 w-1.5 rounded-full bg-purple-500" />
						) : null}
						<Text className="text-[10px] text-muted-foreground">{count}</Text>
					</View>
				) : null}
			</Pressable>
		</View>
	);
}

/**
 * Month grid for the release calendar. Mirrors the web desktop month grid:
 * Monday-anchored 7-column layout with leading/trailing blank cells, a per-day
 * release count with movie/TV dots, and an amber-highlighted "today" cell.
 * Tapping a day with releases bubbles its date key up so the parent can show
 * that day's list. Rows are laid out with flexbox (no arbitrary-value or
 * aspect-ratio classes) for reliable Uniwind/React Native rendering.
 */
export function CalendarMonth({
	monthDate,
	byDate,
	selectedKey,
	onSelectDay,
}: {
	/** Any date within the month to render. */
	monthDate: Date;
	/** Releases keyed by local YYYY-MM-DD. */
	byDate: Map<string, ReleaseCalendarItemDto[]>;
	/** Currently selected day key, or null. */
	selectedKey: string | null;
	onSelectDay: (key: string) => void;
}) {
	const year = monthDate.getFullYear();
	const month = monthDate.getMonth();
	const today = new Date();

	const daysInMonth = new Date(year, month + 1, 0).getDate();
	// Shift so Monday = 0 … Sunday = 6.
	const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

	const cells: DayCell[] = [];
	for (let i = 0; i < firstWeekday; i++) cells.push(null);
	for (let day = 1; day <= daysInMonth; day++) {
		const date = new Date(year, month, day);
		const key = dateKey(date);
		cells.push({
			day,
			key,
			releases: byDate.get(key) ?? [],
			isToday: isSameDay(date, today),
		});
	}
	while (cells.length % 7 !== 0) cells.push(null);

	const rows: DayCell[][] = [];
	for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

	return (
		<View className="gap-1">
			<View className="flex-row">
				{WEEKDAYS.map((label) => (
					<View key={label} className="flex-1 items-center py-1">
						<Text className="font-medium text-muted-foreground text-xs">
							{label}
						</Text>
					</View>
				))}
			</View>

			{rows.map((row, rowIndex) => (
				<View
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length week rows
					key={`week-${rowIndex}`}
					className="flex-row"
				>
					{row.map((cell, colIndex) => (
						<DayCellView
							key={cell ? cell.key : `blank-${rowIndex}-${colIndex}`}
							cell={cell}
							selectedKey={selectedKey}
							onSelectDay={onSelectDay}
						/>
					))}
				</View>
			))}
		</View>
	);
}
