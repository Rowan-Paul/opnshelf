import type { StartCheckInDto } from "@opnshelf/api";
import {
	Check,
	ListPlus,
	type LucideIcon,
	Pencil,
	Play,
	Plus,
	Star,
	StickyNote,
	X,
} from "lucide-react-native";
import { useRef } from "react";
import { Pressable, View } from "react-native";
import { BottomSheetModal } from "@/components/ui/bottom-sheet-modal";
import { Text } from "@/components/ui/text";
import {
	confirmWatchingCheckIn,
	useWatchingCheckIn,
} from "@/lib/use-watching-check-in";
import { useThemeColors } from "@/theme/colors";

/** A single tappable row in the quick-actions sheet. */
function ActionRow({
	icon: Icon,
	label,
	onPress,
	disabled,
	primary,
}: {
	icon: LucideIcon;
	label: string;
	onPress: () => void;
	disabled?: boolean;
	/** Render as the filled accent CTA (the sheet's one focal action). */
	primary?: boolean;
}) {
	const colors = useThemeColors();
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			className={
				primary
					? "flex-row items-center gap-3 rounded-lg border border-primary bg-primary p-3"
					: "flex-row items-center gap-3 rounded-lg border border-border p-3"
			}
			style={{ opacity: disabled ? 0.5 : 1 }}
		>
			<Icon
				color={primary ? colors.accentForeground : colors.mutedForeground}
				size={20}
			/>
			<Text
				className={
					primary
						? "flex-1 font-medium text-primary-foreground text-sm"
						: "flex-1 font-medium text-foreground text-sm"
				}
			>
				{label}
			</Text>
		</Pressable>
	);
}

/**
 * Long-press quick-actions launcher for a `MediaCard`. It's a thin action list:
 * each row dismisses this sheet and opens the corresponding real sheet
 * (rating / list / note) owned by `MediaCard`, except the shelf toggle which
 * fires inline. Both movies and shows expose an add/remove-to-shelf toggle.
 * Rate / list / note apply to both.
 */
export function MediaQuickActionsSheet({
	visible,
	checkInTarget,
	onDismiss,
	title,
	watched,
	onToggleWatched,
	onRate,
	onAddToList,
	onEditNote,
	hasNote,
	isWatchPending,
}: {
	visible: boolean;
	checkInTarget?: StartCheckInDto;
	onDismiss: () => void;
	title: string;
	/** Whether the item is currently on the user's shelf. */
	watched: boolean;
	onToggleWatched: () => void;
	onRate: () => void;
	onAddToList: () => void;
	onEditNote: () => void;
	hasNote: boolean;
	isWatchPending?: boolean;
}) {
	const colors = useThemeColors();
	const checkIn = useWatchingCheckIn(false, visible && !!checkInTarget);
	const afterClose = useRef<(() => void) | undefined>(undefined);
	const active = checkIn.active;
	const watching =
		!!checkInTarget &&
		active?.mediaId === checkInTarget.mediaId &&
		active.seasonNumber === (checkInTarget.seasonNumber ?? null) &&
		active.episodeNumber === (checkInTarget.episodeNumber ?? null);
	const closeThen = (next: () => void) => {
		afterClose.current = next;
		onDismiss();
	};
	const watchLabel = watched ? "Remove from shelf" : "Add to shelf";

	return (
		<BottomSheetModal
			visible={visible}
			onRequestClose={onDismiss}
			onClosed={() => {
				const next = afterClose.current;
				afterClose.current = undefined;
				next?.();
			}}
		>
			<View className="flex-1 justify-end">
				<Pressable className="flex-1" onPress={onDismiss} />
				<View className="gap-3 rounded-t-2xl border border-border bg-card p-5">
					<View className="flex-row items-center justify-between">
						<Text
							className="flex-1 font-display-bold text-foreground text-lg"
							numberOfLines={1}
						>
							{title}
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color={colors.mutedForeground} size={22} />
						</Pressable>
					</View>

					<View className="gap-2">
						{watching ? (
							<>
								<ActionRow
									icon={Check}
									label={active.finishing ? "Try logging again" : "I’m done"}
									disabled={checkIn.pending}
									onPress={() => closeThen(() => checkIn.finish())}
								/>
								<ActionRow
									icon={X}
									label="Cancel check-in"
									disabled={active.finishing || checkIn.pending}
									onPress={() => closeThen(() => checkIn.cancel())}
								/>
							</>
						) : (
							<>
								<ActionRow
									icon={watched ? X : Plus}
									label={watchLabel}
									onPress={onToggleWatched}
									disabled={isWatchPending}
									primary={!watched}
								/>
								{checkInTarget && (
									<ActionRow
										icon={Play}
										label="Start watching now"
										disabled={active?.finishing || checkIn.pending}
										onPress={() =>
											closeThen(() =>
												confirmWatchingCheckIn(checkInTarget, checkIn),
											)
										}
									/>
								)}
							</>
						)}
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
		</BottomSheetModal>
	);
}
