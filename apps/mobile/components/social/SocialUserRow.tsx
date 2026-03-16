import type { SocialUserCardDto } from "@opnshelf/api";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Card, CardContent } from "@/components/ui/Card";
import { SocialFollowButton } from "@/components/social/SocialFollowButton";
import { SocialUserAvatar } from "@/components/social/SocialUserAvatar";
import { getDisplayName } from "@/components/social/social-display";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

export function SocialUserRow({
	user,
	viewerHandle,
	showFollowButton = true,
}: {
	user: SocialUserCardDto;
	viewerHandle?: string | null;
	showFollowButton?: boolean;
}) {
	const { colors } = useTheme();
	const displayName = getDisplayName(user.displayName, user.handle);
	const badge = user.isFollowing
		? user.isFollowedBy
			? "Mutual"
			: "Following"
		: user.isFollowedBy
			? "Follows you"
			: null;

	return (
		<Card
			style={{
				...styles.card,
				backgroundColor: colors.surfaceContainerHigh,
				borderColor: colors.outlineVariant,
			}}
		>
			<CardContent style={styles.content}>
				<TouchableOpacity
					style={styles.identity}
					onPress={() =>
						router.push({
							pathname: "/user/[handle]/shelf",
							params: { handle: user.handle },
						})
					}
				>
					<SocialUserAvatar
						avatar={user.avatar}
						displayName={user.displayName}
						handle={user.handle}
						size={56}
					/>
					<View style={styles.copy}>
						<View style={styles.titleRow}>
							<View style={styles.nameBlock}>
								<Text
									numberOfLines={1}
									style={[styles.displayName, { color: colors.onSurface }]}
								>
									{displayName}
								</Text>
								<Text
									numberOfLines={1}
									style={[styles.handle, { color: colors.onSurfaceVariant }]}
								>
									@{user.handle}
								</Text>
							</View>
							{badge ? (
								<View
									style={[
										styles.badgePill,
										{
											backgroundColor: colors.primaryContainer,
											borderColor: colors.primary,
										},
									]}
								>
									<Text
										style={[
											styles.badgeText,
											{ color: colors.onPrimaryContainer },
										]}
									>
										{badge}
									</Text>
								</View>
							) : null}
						</View>

						<View style={styles.statRow}>
							<View
								style={[
									styles.statPill,
									{
										backgroundColor: colors.surfaceContainer,
										borderColor: colors.outlineVariant,
									},
								]}
							>
								<Text style={[styles.statValue, { color: colors.onSurface }]}>
									{user.followingCount}
								</Text>
								<Text
									style={[
										styles.statLabel,
										{ color: colors.onSurfaceVariant },
									]}
								>
									following
								</Text>
							</View>
							<View
								style={[
									styles.statPill,
									{
										backgroundColor: colors.surfaceContainer,
										borderColor: colors.outlineVariant,
									},
								]}
							>
								<Text style={[styles.statValue, { color: colors.onSurface }]}>
									{user.followersCount}
								</Text>
								<Text
									style={[
										styles.statLabel,
										{ color: colors.onSurfaceVariant },
									]}
								>
									followers
								</Text>
							</View>
						</View>
					</View>
				</TouchableOpacity>
				{showFollowButton ? (
					<View style={styles.buttonRow}>
						<SocialFollowButton
							targetDid={user.did}
							targetHandle={user.handle}
							viewerHandle={viewerHandle}
							isFollowing={user.isFollowing}
							isFollowedBy={user.isFollowedBy}
						/>
					</View>
				) : null}
			</CardContent>
		</Card>
	);
}

const styles = StyleSheet.create({
	card: {
		borderWidth: 1,
		borderRadius: borderRadius.xl,
	},
	content: {
		gap: spacing.md,
		paddingVertical: spacing.md,
	},
	identity: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: spacing.md,
	},
	copy: {
		flex: 1,
		gap: spacing.sm,
	},
	titleRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: spacing.sm,
	},
	nameBlock: {
		flex: 1,
	},
	displayName: {
		fontSize: 18,
		fontWeight: "700",
	},
	handle: {
		fontSize: 14,
		marginTop: 4,
	},
	badgePill: {
		borderWidth: 1,
		borderRadius: borderRadius.full,
		paddingHorizontal: spacing.sm + 2,
		paddingVertical: spacing.xs + 1,
	},
	badgeText: {
		fontSize: 11,
		fontWeight: "700",
		letterSpacing: 0.2,
	},
	statRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	statPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		borderWidth: 1,
		borderRadius: borderRadius.full,
		paddingHorizontal: spacing.sm + 2,
		paddingVertical: spacing.xs + 1,
	},
	statValue: {
		fontSize: 13,
		fontWeight: "700",
	},
	statLabel: {
		fontSize: 12,
		fontWeight: "500",
	},
	buttonRow: {
		alignItems: "flex-start",
	},
});
