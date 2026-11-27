import type { MediaInListDto } from "@opnshelf/api";
import { StickyNote, X } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { MediaCard } from "@/components/media/MediaCard";
import { useDialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { listItemToMediaCardItem } from "@/lib/list-media";

export function getItemLabel(item: MediaInListDto) {
	const { title, episode, label } = listItemToMediaCardItem(item);
	if (episode) {
		return `${episode.showTitle} S${episode.seasonNumber}E${episode.episodeNumber}${episode.episodeTitle ? ` — ${episode.episodeTitle}` : ""}`;
	}
	return label ? `${title} ${label}` : title;
}

export function ListItemCard({
	item,
	onRemove,
	onEditNote,
}: {
	item: MediaInListDto;
	onRemove?: (item: MediaInListDto) => void;
	onEditNote?: () => void;
}) {
	const { showDialog } = useDialog();
	const action = onEditNote
		? item.notes
			? "Edit note"
			: "Add note"
		: "Read note";
	const actionLabel = `${action} for ${getItemLabel(item)}`;
	const openNote =
		onEditNote ??
		(() =>
			showDialog({
				title: "List item note",
				description: getItemLabel(item),
				actions: [{ label: "Close" }],
				body: <Text>{item.notes}</Text>,
			}));

	return (
		<View>
			<View className="relative">
				<MediaCard
					item={listItemToMediaCardItem(item)}
					actions
					watchCount={item.watchCount}
				/>
				{onRemove && (
					<Pressable
						hitSlop={6}
						onPress={() => onRemove(item)}
						accessibilityRole="button"
						accessibilityLabel="Remove from List"
						className="absolute top-1.5 left-1.5 size-7 items-center justify-center rounded-full bg-black/55"
					>
						<X color="#ffffff" size={16} strokeWidth={2.5} />
					</Pressable>
				)}
				{onEditNote || item.notes ? (
					<View
						pointerEvents="box-none"
						className="absolute top-0 left-0 aspect-2/3 w-full"
					>
						<Pressable
							hitSlop={8}
							accessibilityRole="button"
							accessibilityLabel={actionLabel}
							onPress={openNote}
							className={cn(
								"absolute bottom-2 left-2 h-7 min-w-7 flex-row items-center justify-center gap-1 rounded-full px-1.5",
								item.notes ? "bg-white" : "bg-black/55",
							)}
						>
							<StickyNote
								color={item.notes ? "#0f172a" : "#ffffff"}
								size={14}
							/>
							{item.notes ? (
								<Text className="font-semibold text-slate-900 text-xs">
									Note
								</Text>
							) : null}
						</Pressable>
					</View>
				) : null}
			</View>
			{item.notes ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${actionLabel}: ${item.notes}`}
					onPress={openNote}
				>
					<Text className="mt-1 text-sm" numberOfLines={2}>
						{item.notes}
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}
