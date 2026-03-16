import { showsControllerGetUserUpNextInfiniteOptions } from "@opnshelf/api";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { PublicProfileScaffold } from "@/components/social/PublicProfileScaffold";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { usePublicProfile } from "@/hooks/usePublicProfile";

export default function PublicUpNextScreen() {
	const { handle } = useLocalSearchParams<{ handle: string }>();
	const { colors } = useTheme();
	const profileQuery = usePublicProfile(handle);
	const upNextQuery = useInfiniteQuery({
		...showsControllerGetUserUpNextInfiniteOptions({
			path: { userDid: profileQuery.data?.did ?? "" },
			query: { pageSize: 12 },
		}),
		enabled: !!profileQuery.data?.did,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});
	const items = useMemo(
		() => (upNextQuery.data?.pages ?? []).flatMap((page) => page.items),
		[upNextQuery.data],
	);

	return (
		<PublicProfileScaffold section="up-next">
			<View style={styles.section}>
				{items.length === 0 ? (
					<Text style={{ color: colors.onSurfaceVariant }}>
						No up-next items yet.
					</Text>
				) : (
					items.map((item) => (
						<TouchableOpacity
							key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
							onPress={() =>
								router.push({
									pathname:
										"/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
									params: {
										id: item.showId,
										seasonNumber: String(item.nextEpisode.seasonNumber),
										episodeNumber: String(item.nextEpisode.episodeNumber),
									},
								})
							}
						>
							<Card
								style={{
									...styles.card,
									backgroundColor: colors.surfaceContainerHigh,
									borderColor: colors.outlineVariant,
								}}
							>
								<CardContent>
									<Text style={[styles.cardTitle, { color: colors.onSurface }]}>
										{item.show.title}
									</Text>
									<Text
										style={[
											styles.cardSubtitle,
											{ color: colors.onSurfaceVariant },
										]}
									>
										Next: S{item.nextEpisode.seasonNumber} E
										{item.nextEpisode.episodeNumber} · {item.nextEpisode.name}
									</Text>
								</CardContent>
							</Card>
						</TouchableOpacity>
					))
				)}

				{upNextQuery.hasNextPage ? (
					<Button
						variant="outlined"
						onPress={() => void upNextQuery.fetchNextPage()}
						disabled={upNextQuery.isFetchingNextPage}
					>
						<Text>Load more</Text>
					</Button>
				) : null}
			</View>
		</PublicProfileScaffold>
	);
}

const styles = StyleSheet.create({
	section: {
		gap: spacing.md,
	},
	card: {
		borderWidth: 1,
		borderRadius: borderRadius.xl,
	},
	cardTitle: {
		fontSize: 18,
		fontWeight: "700",
	},
	cardSubtitle: {
		fontSize: 13,
		marginTop: 6,
	},
});
