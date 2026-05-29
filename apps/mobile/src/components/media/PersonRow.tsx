import type { SocialUserCardDto } from "@opnshelf/api";
import { Image } from "expo-image";
import { User } from "lucide-react-native";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Row for an app user (social) search result: avatar, display name, handle.
 * Read-only for now — follow actions land in a later phase. The `displayName`
 * / `avatar` fields come through as loosely-typed JSON from the API, so they
 * are coerced to strings defensively.
 */
export function PersonRow({ person }: { person: SocialUserCardDto }) {
	const avatarStyle = useTwStyle("size-11");
	const displayName =
		typeof person.displayName === "string" ? person.displayName : undefined;
	const avatar = typeof person.avatar === "string" ? person.avatar : undefined;
	const name = displayName || person.handle;

	return (
		<View className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-3">
			<View className="size-11 items-center justify-center overflow-hidden rounded-full bg-background-subtle">
				{avatar ? (
					<Image
						source={{ uri: avatar }}
						style={avatarStyle}
						contentFit="cover"
					/>
				) : (
					<User color="#94a3b8" size={20} />
				)}
			</View>
			<View className="min-w-0 flex-1">
				<Text className="font-medium text-foreground text-sm" numberOfLines={1}>
					{name}
				</Text>
				<Text className="text-muted-foreground text-xs" numberOfLines={1}>
					@{person.handle}
				</Text>
			</View>
		</View>
	);
}
