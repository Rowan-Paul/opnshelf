import { Image } from "expo-image";
import { Camera } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * Avatar upload/remove control shared by onboarding's profile step and the
 * edit-profile screen: a tappable round avatar that opens the image picker plus
 * a "Remove photo" affordance when one is set. Upload/remove logic lives in
 * `useProfileSetup` so both call sites use the same backend mutations.
 */
export function AvatarEditor({
	avatarUrl,
	uploading,
	removing,
	onPick,
	onRemove,
}: {
	avatarUrl?: string | null;
	uploading: boolean;
	removing: boolean;
	onPick: () => void;
	onRemove: () => void;
}) {
	return (
		<View className="flex-row items-center gap-4">
			<Pressable
				onPress={onPick}
				disabled={uploading}
				className="size-20 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-background-subtle"
			>
				{avatarUrl ? (
					<Image
						source={{ uri: avatarUrl }}
						style={{ height: 80, width: 80 }}
						contentFit="cover"
					/>
				) : (
					<Camera color="#94a3b8" size={26} />
				)}
				{uploading ? (
					<View className="absolute inset-0 items-center justify-center bg-black/40">
						<ActivityIndicator size="small" color="#ffffff" />
					</View>
				) : null}
			</Pressable>
			<View className="flex-1 gap-1">
				<Text className="font-medium text-foreground text-sm">
					Profile photo
				</Text>
				<Text className="text-muted-foreground text-sm">
					Tap the avatar to choose a photo.
				</Text>
				{avatarUrl ? (
					<Pressable onPress={onRemove} disabled={removing}>
						<Text className="font-medium text-destructive text-sm">
							{removing ? "Removing…" : "Remove photo"}
						</Text>
					</Pressable>
				) : null}
			</View>
		</View>
	);
}
