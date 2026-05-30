import type { SocialUserCardDto } from "@opnshelf/api";
import { Image } from "expo-image";
import { User } from "lucide-react-native";
import { View } from "react-native";
import { FollowButton } from "@/components/social/FollowButton";
import { Text } from "@/components/ui/text";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * A social user row: avatar, display name, handle, and a follow toggle. The
 * `displayName`/`avatar` fields arrive as loosely-typed JSON from the API, so
 * they are coerced to strings defensively (matching `PersonRow`). The follow
 * button is hidden for the current user's own card.
 */
export function UserRow({
	user,
	isSelf,
	onToggleFollow,
}: {
	user: SocialUserCardDto;
	isSelf?: boolean;
	onToggleFollow: (targetDid: string, currentlyFollowing: boolean) => void;
}) {
	const avatarStyle = useTwStyle("size-11");
	const displayName =
		typeof user.displayName === "string" ? user.displayName : undefined;
	const avatar = typeof user.avatar === "string" ? user.avatar : undefined;
	const name = displayName || user.handle;

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
					@{user.handle}
				</Text>
			</View>
			{isSelf ? null : (
				<FollowButton
					following={user.isFollowing}
					onToggle={(currentlyFollowing) =>
						onToggleFollow(user.did, currentlyFollowing)
					}
				/>
			)}
		</View>
	);
}
