import { shelfControllerGetUserShelfInfiniteOptions } from "@opnshelf/api";
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
import { createTitleSlug } from "@/lib/utils";

export default function PublicShelfScreen() {
	const { handle } = useLocalSearchParams<{ handle: string }>();
	const { colors } = useTheme();
	const profileQuery = usePublicProfile(handle);
	const shelfQuery = useInfiniteQuery({
		...shelfControllerGetUserShelfInfiniteOptions({
			path: { userDid: profileQuery.data?.did ?? "" },
			query: { pageSize: 20 },
		}),
		enabled: !!profileQuery.data?.did,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});
	const items = useMemo(
		() => (shelfQuery.data?.pages ?? []).flatMap((page) => page.items),
		[shelfQuery.data],
	);

	return (
		<PublicProfileScaffold section="shelf">
			<View style={styles.section}>
				{items.length === 0 ? (
					<Text style={{ color: colors.onSurfaceVariant }}>
						Nothing on this shelf yet.
					</Text>
				) : (
					items.map((item) => (
						<TouchableOpacity
							key={item.id}
							onPress={() => {
								if (item.type === "movie") {
									router.push({
										pathname: "/movie/[id]",
										params: {
											id: item.movieId,
											title: createTitleSlug(item.title ?? "movie"),
										},
									});
									return;
								}

								router.push({
									pathname:
										"/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
									params: {
										id: item.showId,
										seasonNumber: String(item.seasonNumber),
										episodeNumber: String(item.episodeNumber),
									},
								});
							}}
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
										{item.type === "movie" ? item.title : item.showTitle}
									</Text>
									<Text
										style={[
											styles.cardSubtitle,
											{ color: colors.onSurfaceVariant },
										]}
									>
										{item.type === "movie"
											? "Movie"
											: `Episode · S${item.seasonNumber} E${item.episodeNumber}`}
									</Text>
								</CardContent>
							</Card>
						</TouchableOpacity>
					))
				)}

				{shelfQuery.hasNextPage ? (
					<Button
						variant="outlined"
						onPress={() => void shelfQuery.fetchNextPage()}
						disabled={shelfQuery.isFetchingNextPage}
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
