import { Share2 } from "lucide-react-native";
import { Pressable, Share, View } from "react-native";
import { Text } from "@/components/ui/text";
import { posthog } from "@/lib/posthog";
import { useThemeColors } from "@/theme/colors";

/**
 * Share action for media detail screens. Mirrors web's `MediaActionsBar` share:
 * opens the OS share sheet with the public web URL for this title. Always shown
 * — sharing needs no auth. The `url` is built by `webMediaUrl` at the call site
 * (season/episode need the parent show's name for the slug).
 */
export function ShareButton({ url, title }: { url: string; title: string }) {
	const colors = useThemeColors();
	const onShare = () => {
		// message carries the URL (Android ignores the `url` field); title names
		// the Android chooser. iOS shows the link from the message text.
		Share.share({ message: url, title })
			.then((result) => {
				if (result.action === Share.sharedAction) {
					posthog?.capture("share_completed", { surface: "media_detail" });
				}
			})
			.catch(() => {});
	};

	return (
		<View className="flex-1">
			<Pressable
				onPress={onShare}
				className="flex-1 items-center justify-center gap-1 rounded-lg border border-border px-1 py-2.5"
			>
				<Share2 color={colors.mutedForeground} size={18} />
				<Text className="font-medium text-foreground text-xs" numberOfLines={1}>
					Share
				</Text>
			</Pressable>
		</View>
	);
}
