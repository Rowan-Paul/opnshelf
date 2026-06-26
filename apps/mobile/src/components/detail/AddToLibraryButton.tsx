import { Disc } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AddToLibrarySheet } from "@/components/library/AddToLibrarySheet";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useLibraryOwnership } from "@/lib/use-library";

/**
 * "Add to library" action for media detail screens. Opens a sheet of Formats
 * with ownership toggles. Shows how many formats the item is owned in.
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
		<View className="px-4">
			<Pressable
				onPress={() => setSheetVisible(true)}
				className="flex-row items-center justify-center gap-2 rounded-lg border border-border py-3"
			>
				<Disc color="#94a3b8" size={18} />
				<Text className="font-semibold text-foreground">
					{count > 0
						? `Owned · ${count} format${count === 1 ? "" : "s"}`
						: "Add to library"}
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
