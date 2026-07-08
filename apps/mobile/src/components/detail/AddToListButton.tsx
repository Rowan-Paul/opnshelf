import { ListPlus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AddToListSheet } from "@/components/lists/AddToListSheet";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useListMembership } from "@/lib/use-lists";

/**
 * "Add to list" action for media detail screens: a compact tile (flex-1, laid
 * out in the shared secondary-actions row). Opens a sheet of the user's lists
 * with membership toggles; shows how many lists the item is in.
 */
export function AddToListButton({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}) {
	const { isAuthenticated } = useAuth();
	const [sheetVisible, setSheetVisible] = useState(false);
	const { memberships, isLoading, toggle } = useListMembership({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	if (!isAuthenticated) return null;

	const inCount = memberships.filter((l) => l.isInList).length;

	return (
		<View className="flex-1">
			<Pressable
				onPress={() => setSheetVisible(true)}
				className="items-center justify-center gap-1 rounded-lg border border-border px-1 py-2.5"
			>
				<ListPlus color={inCount > 0 ? "#f3bc00" : "#94a3b8"} size={18} />
				<Text className="font-medium text-foreground text-xs" numberOfLines={1}>
					{inCount > 0
						? `In ${inCount} list${inCount === 1 ? "" : "s"}`
						: "List"}
				</Text>
			</Pressable>

			<AddToListSheet
				visible={sheetVisible}
				onDismiss={() => setSheetVisible(false)}
				memberships={memberships}
				isLoading={isLoading}
				onToggle={toggle}
			/>
		</View>
	);
}
