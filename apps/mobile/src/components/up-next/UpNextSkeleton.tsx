import { View } from "react-native";

/** Shape-matched placeholders mirroring UpNextCard, so sections don't claim
 * to be empty (or jump around when real content arrives) while pending. */
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

export function UpNextSkeleton({ rows = 2 }: { rows?: number }) {
	return (
		<View className="gap-3">
			{Array.from({ length: rows }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows never reorder
				<UpNextRowSkeleton key={i} />
			))}
		</View>
	);
}
