import {
	type PublicUserProfileDto,
	socialControllerFollowMutation,
	socialControllerGetRelationshipQueryKey,
	socialControllerUnfollowMutation,
	usersControllerGetPublicProfileQueryKey,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Check, User, UserPlus } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useRelationship } from "@/lib/use-public-profile";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Public profile header: avatar, display name, handle, follower/following
 * counts, and a follow/unfollow button. Mirrors the web profile layout header.
 * Counts are pressable and switch the screen to the Connections tab.
 */
export function ProfileHeader({
	profile,
	handle,
	isOwner,
	isAuthenticated,
	onPressConnections,
}: {
	profile: PublicUserProfileDto;
	handle: string;
	isOwner: boolean;
	isAuthenticated: boolean;
	onPressConnections: (tab: "followers" | "following") => void;
}) {
	const avatarStyle = useTwStyle("size-20 rounded-full");
	const queryClient = useQueryClient();
	const toast = useToast();

	const targetDid = profile.did;
	const name = profile.displayName || profile.handle;

	const { data: relationship } = useRelationship(
		targetDid,
		isAuthenticated && !isOwner,
	);

	const invalidate = () => {
		queryClient.invalidateQueries({
			queryKey: socialControllerGetRelationshipQueryKey({
				path: { targetDid },
			}),
		});
		queryClient.invalidateQueries({
			queryKey: usersControllerGetPublicProfileQueryKey({ path: { handle } }),
		});
	};

	const followMutation = useMutation({
		mutationKey: ["social", "follow", targetDid],
		...socialControllerFollowMutation(),
		onSuccess: invalidate,
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Failed to follow"),
	});
	const unfollowMutation = useMutation({
		mutationKey: ["social", "unfollow", targetDid],
		...socialControllerUnfollowMutation(),
		onSuccess: invalidate,
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to unfollow",
			),
	});

	const isPending = followMutation.isPending || unfollowMutation.isPending;
	const isFollowing = !!relationship?.isFollowing;
	const showFollow = isAuthenticated && !isOwner && relationship?.canFollow;

	const handleToggle = () => {
		void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
		if (isFollowing) {
			unfollowMutation.mutate({ path: { targetDid } });
		} else {
			followMutation.mutate({ path: { targetDid } });
		}
	};

	return (
		<View className="gap-4 px-4 pt-2 pb-4">
			<View className="flex-row items-center gap-4">
				<View className="size-20 items-center justify-center overflow-hidden rounded-full border border-border bg-background-subtle">
					{profile.avatar ? (
						<Image
							source={{ uri: profile.avatar }}
							style={avatarStyle}
							contentFit="cover"
						/>
					) : (
						<User color="#94a3b8" size={32} />
					)}
				</View>

				<View className="min-w-0 flex-1">
					<View className="flex-row items-center gap-2">
						<Text
							className="font-bold font-display text-foreground text-xl"
							numberOfLines={1}
						>
							{name}
						</Text>
						{isOwner ? (
							<View className="rounded-full bg-background-subtle px-2 py-0.5">
								<Text className="text-muted-foreground text-xs">You</Text>
							</View>
						) : null}
					</View>
					<Text className="text-muted-foreground text-sm" numberOfLines={1}>
						@{profile.handle}
					</Text>
				</View>
			</View>

			{/* Counts + follow */}
			<View className="flex-row items-center gap-6">
				<Pressable onPress={() => onPressConnections("followers")}>
					<View className="flex-row items-baseline gap-1.5">
						<Text className="font-semibold text-base text-foreground">
							{profile.followersCount}
						</Text>
						<Text className="text-muted-foreground text-sm">Followers</Text>
					</View>
				</Pressable>
				<Pressable onPress={() => onPressConnections("following")}>
					<View className="flex-row items-baseline gap-1.5">
						<Text className="font-semibold text-base text-foreground">
							{profile.followingCount}
						</Text>
						<Text className="text-muted-foreground text-sm">Following</Text>
					</View>
				</Pressable>

				{showFollow ? (
					<Pressable
						onPress={handleToggle}
						disabled={isPending}
						className={cn(
							"ml-auto flex-row items-center gap-1.5 rounded-full px-4 py-2",
							isFollowing ? "border border-border bg-card" : "bg-primary",
							isPending && "opacity-60",
						)}
					>
						{isFollowing ? (
							<>
								<Check color="#94a3b8" size={15} strokeWidth={3} />
								<Text className="font-medium text-muted-foreground text-sm">
									Following
								</Text>
							</>
						) : (
							<>
								<UserPlus color="#3f2e00" size={15} />
								<Text className="font-medium text-primary-foreground text-sm">
									Follow
								</Text>
							</>
						)}
					</Pressable>
				) : null}
			</View>
		</View>
	);
}
