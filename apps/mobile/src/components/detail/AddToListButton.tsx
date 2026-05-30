import { ListPlus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AddToListSheet } from "@/components/lists/AddToListSheet";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useListMembership } from "@/lib/use-lists";

/**
 * "Add to list" action for media detail screens. Opens a sheet of the user's
 * lists with membership toggles. Shows how many lists the item is in.
 */
export function AddToListButton({
	mediaType,
	mediaId,
}: {
	mediaType: "movie" | "show";
	mediaId: string;
}) {
	const { isAuthenticated } = useAuth();
	const [sheetVisible, setSheetVisible] = useState(false);
	const { memberships, isLoading, toggle } = useListMembership({
		mediaType,
		mediaId,
	});

	if (!isAuthenticated) return null;

	const inCount = memberships.filter((l) => l.isInList).length;

	return (
		<View className="px-4">
			<Pressable
				onPress={() => setSheetVisible(true)}
				className="flex-row items-center justify-center gap-2 rounded-lg border border-border py-3"
			>
				<ListPlus color="#94a3b8" size={18} />
				<Text className="font-semibold text-foreground">
					{inCount > 0
						? `In ${inCount} list${inCount === 1 ? "" : "s"}`
						: "Add to list"}
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
