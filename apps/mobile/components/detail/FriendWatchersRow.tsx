import type { FollowedWatchersDto } from "@opnshelf/api";
import { Users } from "lucide-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SocialUserAvatar } from "@/components/social/SocialUserAvatar";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import type { ColorTheme } from "./types";

type FriendWatchersRowProps = {
	watchers?: FollowedWatchersDto;
	isLoading?: boolean;
	colors: ColorTheme;
	onPressWatcher?: (handle: string) => void;
};

export function FriendWatchersRow({
	watchers,
	isLoading = false,
	colors,
	onPressWatcher,
}: FriendWatchersRowProps) {
	const { colors: themeColors } = useTheme();

	if (isLoading) {
		return (
			<View style={styles.container}>
				<View style={styles.avatarGroup}>
					{Array.from({ length: 4 }, (_, index) => (
						<View
							key={`watcher-skeleton-${index + 1}`}
							style={[
								styles.skeletonAvatar,
								{
									backgroundColor: themeColors.surfaceContainerHighest,
									marginLeft: index === 0 ? 0 : -10,
								},
							]}
						/>
					))}
				</View>
				<View
					style={[
						styles.skeletonBadge,
						{ backgroundColor: themeColors.surfaceContainerHighest },
					]}
				/>
			</View>
		);
	}

	if (!watchers || watchers.total === 0 || watchers.items.length === 0) {
		return null;
	}

	const overflowCount = Math.max(watchers.total - watchers.items.length, 0);

	return (
		<View style={styles.container}>
			<View style={styles.avatarGroup}>
				{watchers.items.map((watcher, index) => {
					const content = (
						<View
							style={[
								styles.avatarFrame,
								{
									marginLeft: index === 0 ? 0 : -10,
									borderColor: themeColors.surface,
								},
							]}
						>
							<SocialUserAvatar
								avatar={watcher.actor.avatar}
								displayName={watcher.actor.displayName}
								handle={watcher.actor.handle}
								size={32}
							/>
						</View>
					);

					if (!onPressWatcher) {
						return <View key={watcher.actor.did}>{content}</View>;
					}

					return (
						<TouchableOpacity
							key={watcher.actor.did}
							onPress={() => onPressWatcher(watcher.actor.handle)}
							activeOpacity={0.8}
						>
							{content}
						</TouchableOpacity>
					);
				})}
			</View>
			{overflowCount > 0 ? (
				<View
					style={[
						styles.overflowBadge,
						{ backgroundColor: themeColors.surfaceContainer },
					]}
				>
					<Users size={12} color={colors.primary} />
					<Text
						style={[
							styles.overflowLabel,
							{ color: themeColors.onSurfaceVariant },
						]}
					>
						+{overflowCount}
					</Text>
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		alignSelf: "flex-start",
		paddingLeft: spacing.xs,
		maxWidth: "100%",
		minHeight: 32,
	},
	avatarGroup: {
		flexDirection: "row",
		alignItems: "center",
		flexShrink: 1,
		overflow: "hidden",
	},
	avatarFrame: {
		borderWidth: 2,
		borderRadius: borderRadius.full,
	},
	overflowBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.sm,
		height: 32,
		borderRadius: borderRadius.full,
	},
	overflowLabel: {
		fontSize: 12,
		fontWeight: "600",
	},
	skeletonAvatar: {
		width: 32,
		height: 32,
		borderRadius: borderRadius.full,
	},
	skeletonBadge: {
		height: 32,
		borderRadius: borderRadius.full,
		width: 56,
	},
});
