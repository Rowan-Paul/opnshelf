import { Disc } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AddToLibrarySheet } from "@/components/library/AddToLibrarySheet";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useLibraryOwnership } from "@/lib/use-library";

/**
 * "Add to library" action for media detail screens: a compact tile (flex-1,
 * laid out in the shared secondary-actions row). Opens a sheet of Formats with
 * ownership toggles; shows how many formats the item is owned in.
 */
export function AddToLibraryButton({
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
	const { ownedFormats, isLoading, toggle } = useLibraryOwnership({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	if (!isAuthenticated) return null;

	const count = ownedFormats.size;

	return (
		<View className="flex-1">
			<Pressable
				onPress={() => setSheetVisible(true)}
				className="items-center justify-center gap-1 rounded-lg border border-border px-1 py-2.5"
			>
				<Disc color={count > 0 ? "#f3bc00" : "#94a3b8"} size={18} />
				<Text className="font-medium text-foreground text-xs" numberOfLines={1}>
					{count > 0 ? `Owned · ${count}` : "Library"}
				</Text>
			</Pressable>

			<AddToLibrarySheet
				visible={sheetVisible}
				onDismiss={() => setSheetVisible(false)}
				ownedFormats={ownedFormats}
				isLoading={isLoading}
				onToggle={toggle}
			/>
		</View>
	);
}
