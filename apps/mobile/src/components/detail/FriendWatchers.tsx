import { Image } from "expo-image";
import { User } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useWatchers } from "@/lib/use-social";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Horizontal row of avatars for people the current user follows who have
 * watched this title. Renders nothing when there are none. Backed by
 * `socialControllerGetWatchers`.
 */
export function FriendWatchers({
	mediaType,
	mediaId,
}: {
	mediaType: "movie" | "show";
	mediaId: string;
}) {
	const avatarStyle = useTwStyle("size-10");
	const { data } = useWatchers(mediaType, mediaId);
	const watchers = data?.items ?? [];

	if (watchers.length === 0) return null;

	return (
		<View className="gap-2 px-4">
			<Text className="font-display font-semibold text-base text-foreground">
				Watched by friends
			</Text>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerClassName="gap-3"
			>
				{watchers.map(({ actor }) => {
					const name = actor.displayName || actor.handle;
					return (
						<View key={actor.did} className="w-14 items-center gap-1">
							<View className="size-10 items-center justify-center overflow-hidden rounded-full bg-background-subtle">
								{actor.avatar ? (
									<Image
										source={{ uri: actor.avatar }}
										style={avatarStyle}
										contentFit="cover"
									/>
								) : (
									<User color="#94a3b8" size={18} />
								)}
							</View>
							<Text
								className="text-center text-muted-foreground text-xs"
								numberOfLines={1}
							>
								{name}
							</Text>
						</View>
					);
				})}
			</ScrollView>
		</View>
	);
}
