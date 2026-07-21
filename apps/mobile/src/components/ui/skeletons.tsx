import { View } from "react-native";
import { UpNextRowSkeleton } from "@/components/up-next/UpNextSkeleton";

/** Shape-matched loading placeholders (preferred over spinners for content
 * areas): they preserve layout so nothing jumps when real content arrives. */

const IDX = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Horizontal poster row (Shelf/Library previews, filmography). */
export function PosterRowSkeleton({ width = 110 }: { width?: number }) {
	return (
		<View className="flex-row gap-3 overflow-hidden">
			{IDX(3).map((i) => (
				<View key={i} style={{ width }}>
					<View className="aspect-2/3 w-full rounded-lg bg-background-subtle" />
					<View className="mt-2 h-3 w-4/5 rounded bg-background-subtle" />
					<View className="mt-1.5 h-2.5 w-1/2 rounded bg-background-subtle" />
				</View>
			))}
		</View>
	);
}

/** Poster grid (shelf/library tabs, list details, search results). */
export function PosterGridSkeleton({
	rows = 2,
	columns = 3,
}: {
	rows?: number;
	columns?: number;
}) {
	return (
		<View className="flex-row flex-wrap gap-3">
			{IDX(rows * columns).map((i) => (
				<View key={i} style={{ width: `${100 / columns - 2}%` }}>
					<View className="aspect-2/3 w-full rounded-lg bg-background-subtle" />
					<View className="mt-2 h-3 w-4/5 rounded bg-background-subtle" />
				</View>
			))}
		</View>
	);
}

/** Bordered card rows with two text lines (lists index, settings rows). */
export function ListRowsSkeleton({ rows = 2 }: { rows?: number }) {
	return (
		<View className="gap-2">
			{IDX(rows).map((i) => (
				<View key={i} className="rounded-xl border border-border bg-card p-4">
					<View className="h-3.5 w-2/5 rounded bg-background-subtle" />
					<View className="mt-2 h-2.5 w-1/4 rounded bg-background-subtle" />
				</View>
			))}
		</View>
	);
}

/** Avatar + two text lines (connections, people search, follow suggestions). */
export function UserRowsSkeleton({ rows = 4 }: { rows?: number }) {
	return (
		<View className="gap-2">
			{IDX(rows).map((i) => (
				<View
					key={i}
					className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4"
				>
					<View className="h-12 w-12 rounded-full bg-background-subtle" />
					<View className="flex-1 gap-2">
						<View className="h-3 w-1/2 rounded bg-background-subtle" />
						<View className="h-2.5 w-1/3 rounded bg-background-subtle" />
					</View>
				</View>
			))}
		</View>
	);
}

/** Review/activity cards: poster thumb + text lines. */
export function ReviewsSkeleton({ rows = 2 }: { rows?: number }) {
	return (
		<View className="gap-3">
			{IDX(rows).map((i) => (
				<UpNextRowSkeleton key={i} extraLine />
			))}
		</View>
	);
}

/** Detail pages (movie/show/season/episode): hero poster + title + action
 * pills + overview lines. */
export function DetailSkeleton() {
	return (
		<View className="gap-6 px-4 pt-4">
			<View className="flex-row gap-4">
				<View className="h-40 w-28 rounded-lg bg-background-subtle" />
				<View className="flex-1 justify-center gap-2">
					<View className="h-5 w-4/5 rounded bg-background-subtle" />
					<View className="h-3 w-1/2 rounded bg-background-subtle" />
					<View className="h-3 w-2/5 rounded bg-background-subtle" />
				</View>
			</View>
			<View className="flex-row gap-2">
				<View className="h-10 flex-1 rounded-lg bg-background-subtle" />
				<View className="h-10 w-10 rounded-lg bg-background-subtle" />
				<View className="h-10 w-10 rounded-lg bg-background-subtle" />
			</View>
			<View className="gap-2">
				<View className="h-3 w-full rounded bg-background-subtle" />
				<View className="h-3 w-full rounded bg-background-subtle" />
				<View className="h-3 w-2/3 rounded bg-background-subtle" />
			</View>
		</View>
	);
}

/** Profile header: avatar + name + stats strip. */
export function ProfileHeaderSkeleton() {
	return (
		<View className="items-center gap-3 px-4 pt-6">
			<View className="h-20 w-20 rounded-full bg-background-subtle" />
			<View className="h-4 w-32 rounded bg-background-subtle" />
			<View className="h-3 w-24 rounded bg-background-subtle" />
			<View className="mt-2 h-16 w-full rounded-xl bg-background-subtle" />
		</View>
	);
}
