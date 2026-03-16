import { listsControllerGetPublicUserListsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { PublicProfileScaffold } from "@/components/social/PublicProfileScaffold";
import { Card, CardContent } from "@/components/ui/Card";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { usePublicProfile } from "@/hooks/usePublicProfile";

export default function PublicListsScreen() {
	const { handle } = useLocalSearchParams<{ handle: string }>();
	const { colors } = useTheme();
	const profileQuery = usePublicProfile(handle);
	const listsQuery = useQuery({
		...listsControllerGetPublicUserListsOptions({
			path: { userDid: profileQuery.data?.did ?? "" },
		}),
		enabled: !!profileQuery.data?.did,
	});

	return (
		<PublicProfileScaffold section="lists">
			<View style={styles.section}>
				{(listsQuery.data ?? []).length === 0 ? (
					<Text style={{ color: colors.onSurfaceVariant }}>
						No public lists yet.
					</Text>
				) : (
					(listsQuery.data ?? []).map((list) => (
						<Card
							key={list.id}
							style={{
								...styles.card,
								backgroundColor: colors.surfaceContainerHigh,
								borderColor: colors.outlineVariant,
							}}
						>
							<CardContent>
								<Text style={[styles.cardTitle, { color: colors.onSurface }]}>
									{list.name}
								</Text>
								{list.description ? (
									<Text
										style={[
											styles.cardDescription,
											{ color: colors.onSurfaceVariant },
										]}
									>
										{list.description}
									</Text>
								) : null}
								<Text
									style={[styles.cardMeta, { color: colors.onSurfaceVariant }]}
								>
									{list.movieCount} item{list.movieCount === 1 ? "" : "s"}
								</Text>
							</CardContent>
						</Card>
					))
				)}
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
	cardDescription: {
		fontSize: 14,
		marginTop: 6,
	},
	cardMeta: {
		fontSize: 13,
		marginTop: 10,
	},
});
