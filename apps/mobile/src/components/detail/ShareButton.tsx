import { Share2 } from "lucide-react-native";
import { Pressable, Share, View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * Share action for media detail screens. Mirrors web's `MediaActionsBar` share:
 * opens the OS share sheet with the public web URL for this title. Always shown
 * — sharing needs no auth. The `url` is built by `webMediaUrl` at the call site
 * (season/episode need the parent show's name for the slug).
 */
export function ShareButton({ url, title }: { url: string; title: string }) {
	const onShare = () => {
		// message carries the URL (Android ignores the `url` field); title names
		// the Android chooser. iOS shows the link from the message text.
		Share.share({ message: url, title }).catch(() => {});
	};

	return (
		<View className="px-4">
			<Pressable
				onPress={onShare}
				className="flex-row items-center justify-center gap-2 rounded-lg border border-border py-3"
			>
				<Share2 color="#94a3b8" size={18} />
				<Text className="font-semibold text-foreground">Share</Text>
			</Pressable>
		</View>
	);
}
