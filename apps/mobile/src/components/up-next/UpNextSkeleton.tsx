import { View } from "react-native";

/** Compact rows reused by review/activity placeholders. */
export function UpNextRowSkeleton({
	extraLine = false,
}: {
	extraLine?: boolean;
}) {
	return (
		<View className="flex-row gap-3 rounded-xl border border-border bg-card p-3">
			<View className="h-24 w-16 rounded-md bg-background-subtle" />
			<View className="flex-1 justify-center gap-2">
				<View className="h-3 w-3/4 rounded bg-background-subtle" />
				<View className="h-2.5 w-1/2 rounded bg-background-subtle" />
				<View className="h-2.5 w-2/3 rounded bg-background-subtle" />
				{extraLine ? (
					<View className="h-2.5 w-1/3 rounded bg-background-subtle" />
				) : null}
			</View>
		</View>
	);
}

export function UpNextSkeleton({
	rows = 2,
	variant = "compact",
}: {
	rows?: number;
	variant?: "compact" | "tile";
}) {
	if (variant === "compact")
		return (
			<View className="gap-3">
				{Array.from({ length: rows }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
					<UpNextRowSkeleton key={i} />
				))}
			</View>
		);
	return (
		<View className="gap-3">
			{Array.from({ length: rows }, (_, i) => (
				<View
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows never reorder
					key={i}
					className="overflow-hidden rounded-xl border border-border bg-card"
					accessible={false}
				>
					<View
						className="animate-pulse bg-background-subtle"
						style={{ aspectRatio: 16 / 9 }}
					/>
					<View className="gap-4 p-4">
						<View className="h-4 w-2/3 animate-pulse rounded bg-background-subtle" />
						<View className="gap-2">
							<View className="h-3 animate-pulse rounded bg-background-subtle" />
							<View className="h-3 animate-pulse rounded bg-background-subtle" />
							<View className="h-3 w-3/4 animate-pulse rounded bg-background-subtle" />
						</View>
						<View className="flex-row items-center justify-between">
							<View className="h-3 w-28 animate-pulse rounded bg-background-subtle" />
							<View className="h-10 w-32 animate-pulse rounded bg-background-subtle" />
						</View>
					</View>
				</View>
			))}
		</View>
	);
}
