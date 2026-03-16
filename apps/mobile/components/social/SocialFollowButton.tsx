import { socialControllerFollowMutation, socialControllerUnfollowMutation } from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { Button } from "@/components/ui/Button";
import { borderRadius, spacing } from "@/constants/spacing";
import { useToast } from "@/contexts/toast";
import { useTheme } from "@/contexts/theme";
import { invalidateSocialQueries } from "@/lib/invalidate-social";

function getFollowLabel(isFollowing: boolean, isFollowedBy: boolean) {
	if (!isFollowing && isFollowedBy) {
		return "Follow back";
	}

	return isFollowing ? "Following" : "Follow";
}

export function SocialFollowButton({
	targetDid,
	targetHandle,
	viewerHandle,
	isFollowing,
	isFollowedBy,
	disabled = false,
}: {
	targetDid: string;
	targetHandle: string;
	viewerHandle?: string | null;
	isFollowing: boolean;
	isFollowedBy: boolean;
	disabled?: boolean;
}) {
	const queryClient = useQueryClient();
	const { showToast } = useToast();
	const { colors } = useTheme();

	const followMutation = useMutation({
		mutationKey: ["social", "follow", "create"],
		...socialControllerFollowMutation(),
		onSuccess: async () => {
			await invalidateSocialQueries(queryClient, {
				targetDid,
				targetHandle,
				viewerHandle,
			});
		},
		onError: () => {
			showToast("Could not follow right now.", "error");
		},
	});

	const unfollowMutation = useMutation({
		mutationKey: ["social", "follow", "delete"],
		...socialControllerUnfollowMutation(),
		onSuccess: async () => {
			await invalidateSocialQueries(queryClient, {
				targetDid,
				targetHandle,
				viewerHandle,
			});
		},
		onError: () => {
			showToast("Could not unfollow right now.", "error");
		},
	});

	const isPending = followMutation.isPending || unfollowMutation.isPending;
	const label = getFollowLabel(isFollowing, isFollowedBy);
	const variant = isFollowing
		? "filled-tonal"
		: isFollowedBy
			? "outlined"
			: "filled";
	const labelColor = isFollowing
		? colors.onSecondaryContainer
		: isFollowedBy
			? colors.primary
			: colors.onPrimary;
	const spinnerColor = isFollowing
		? colors.onSecondaryContainer
		: isFollowedBy
			? colors.primary
			: colors.onPrimary;

	return (
		<Button
			variant={variant}
			size="sm"
			style={styles.button}
			onPress={() => {
				if (isFollowing) {
					unfollowMutation.mutate({ path: { targetDid } });
					return;
				}

				followMutation.mutate({ path: { targetDid } });
			}}
			disabled={disabled || isPending}
		>
			{isPending ? (
				<ActivityIndicator size="small" color={spinnerColor} />
			) : null}
			<Text style={[styles.label, { color: labelColor }]}>{label}</Text>
		</Button>
	);
}

const styles = StyleSheet.create({
	button: {
		borderRadius: borderRadius.full,
		minWidth: 112,
		paddingHorizontal: spacing.md,
	},
	label: {
		fontSize: 14,
		fontWeight: "700",
	},
});
