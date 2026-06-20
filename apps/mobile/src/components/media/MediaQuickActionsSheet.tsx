import {
	Eye,
	EyeOff,
	ListPlus,
	type LucideIcon,
	Pencil,
	Star,
	StickyNote,
	X,
} from "lucide-react-native";
import { Modal, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

/** A single tappable row in the quick-actions sheet. */
function ActionRow({
	icon: Icon,
	label,
	onPress,
	disabled,
}: {
	icon: LucideIcon;
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			className="flex-row items-center gap-3 rounded-lg border border-border p-3"
			style={{ opacity: disabled ? 0.5 : 1 }}
		>
			<Icon color="#94a3b8" size={20} />
			<Text className="flex-1 font-medium text-foreground text-sm">
				{label}
			</Text>
		</Pressable>
	);
}

/**
 * Long-press quick-actions launcher for a `MediaCard`. It's a thin action list:
 * each row dismisses this sheet and opens the corresponding real sheet
 * (rating / list / note) owned by `MediaCard`, except the watched toggle which
 * fires inline. Movies expose a watched toggle; shows expose a "start/stop
 * tracking" toggle. Rate / list / note apply to both.
 */
export function MediaQuickActionsSheet({
	visible,
	onDismiss,
	title,
	mediaType,
	watched,
	onToggleWatched,
	onRate,
	onAddToList,
	onEditNote,
	hasNote,
	isWatchPending,
}: {
	visible: boolean;
	onDismiss: () => void;
	title: string;
	mediaType: "movie" | "show";
	/** Movie: watched. Show: currently tracking. */
	watched: boolean;
	onToggleWatched: () => void;
	onRate: () => void;
	onAddToList: () => void;
	onEditNote: () => void;
	hasNote: boolean;
	isWatchPending?: boolean;
}) {
	const watchLabel =
		mediaType === "movie"
			? watched
				? "Unwatch"
				: "Mark watched"
			: watched
				? "Stop tracking"
				: "Mark watched";

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onDismiss}
		>
			<View className="flex-1 justify-end">
				<Pressable className="flex-1" onPress={onDismiss} />
				<View className="gap-3 rounded-t-2xl border border-border bg-card p-5">
					<View className="flex-row items-center justify-between">
						<Text
							className="flex-1 font-bold font-display text-foreground text-lg"
							numberOfLines={1}
						>
							{title}
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					<View className="gap-2">
						<ActionRow
							icon={watched ? EyeOff : Eye}
							label={watchLabel}
							onPress={onToggleWatched}
							disabled={isWatchPending}
						/>
						<ActionRow icon={Star} label="Rate" onPress={onRate} />
						<ActionRow
							icon={ListPlus}
							label="Add to list"
							onPress={onAddToList}
						/>
						<ActionRow
							icon={hasNote ? Pencil : StickyNote}
							label={hasNote ? "Edit note" : "Add note"}
							onPress={onEditNote}
						/>
					</View>
				</View>
			</View>
		</Modal>
	);
}
