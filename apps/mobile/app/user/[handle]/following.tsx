import { socialControllerGetFollowingInfiniteOptions } from "@opnshelf/api";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PublicProfileScaffold } from "@/components/social/PublicProfileScaffold";
import { SocialConnectionsSection } from "@/components/social/SocialConnectionsSection";
import { spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";

export default function PublicFollowingScreen() {
	const { handle } = useLocalSearchParams<{ handle: string }>();
	const { user } = useAuth();
	const { colors } = useTheme();
	const followingQuery = useInfiniteQuery({
		...socialControllerGetFollowingInfiniteOptions({
			path: { handle: handle ?? "" },
			query: { pageSize: 20 },
		}),
		enabled: !!user?.did && !!handle,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});
	const items = useMemo(
		() => (followingQuery.data?.pages ?? []).flatMap((page) => page.items),
		[followingQuery.data],
	);

	return (
		<PublicProfileScaffold section="following">
			<View style={styles.section}>
				{!user ? (
					<Text style={{ color: colors.onSurfaceVariant }}>
						Sign in to view following.
					</Text>
				) : (
					<SocialConnectionsSection
						emptyDescription="This profile is not following anyone on OpnShelf yet."
						emptyTitle="Not following anyone yet"
						hasNextPage={followingQuery.hasNextPage}
						isFetchingNextPage={followingQuery.isFetchingNextPage}
						isLoading={followingQuery.isLoading}
						items={items}
						onLoadMore={() => void followingQuery.fetchNextPage()}
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
