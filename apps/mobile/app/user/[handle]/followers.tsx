import { socialControllerGetFollowersInfiniteOptions } from "@opnshelf/api";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PublicProfileScaffold } from "@/components/social/PublicProfileScaffold";
import { SocialConnectionsSection } from "@/components/social/SocialConnectionsSection";
import { spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";

export default function PublicFollowersScreen() {
	const { handle } = useLocalSearchParams<{ handle: string }>();
	const { user } = useAuth();
	const { colors } = useTheme();
	const followersQuery = useInfiniteQuery({
		...socialControllerGetFollowersInfiniteOptions({
			path: { handle: handle ?? "" },
			query: { pageSize: 20 },
		}),
		enabled: !!user?.did && !!handle,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});
	const items = useMemo(
		() => (followersQuery.data?.pages ?? []).flatMap((page) => page.items),
		[followersQuery.data],
	);

	return (
		<PublicProfileScaffold section="followers">
			<View style={styles.section}>
				{!user ? (
					<Text style={{ color: colors.onSurfaceVariant }}>
						Sign in to view followers.
					</Text>
				) : (
					<SocialConnectionsSection
						emptyDescription="No one is following this profile on OpnShelf yet."
						emptyTitle="No followers yet"
						hasNextPage={followersQuery.hasNextPage}
						isFetchingNextPage={followersQuery.isFetchingNextPage}
						isLoading={followersQuery.isLoading}
						items={items}
						onLoadMore={() => void followersQuery.fetchNextPage()}
						viewerHandle={user.handle}
					/>
				)}
			</View>
		</PublicProfileScaffold>
	);
}

const styles = StyleSheet.create({
	section: {
		gap: spacing.md,
	},
});
