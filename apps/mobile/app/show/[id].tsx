import {
	showsControllerGetShowDetailsOptions,
	type TmdbShowDetailDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/theme";

export default function ShowDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const { colors } = useTheme();

	const { data } = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId: id },
		}),
	});

	const show = data as TmdbShowDetailDto | undefined;
	const seasonCount = show?.number_of_seasons || 0;

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={[styles.title, { color: colors.onBackground }]}>
					{show?.name}
				</Text>
				<Text style={[styles.overview, { color: colors.onSurfaceVariant }]}>
					{show?.overview || "No overview available."}
				</Text>
				<View style={styles.grid}>
					{Array.from({ length: seasonCount }).map((_, index) => {
						const seasonNumber = index + 1;
						return (
							<TouchableOpacity
								key={seasonNumber}
								style={[
									styles.seasonCard,
									{
										borderColor: colors.outline,
										backgroundColor: colors.surfaceContainer,
									},
								]}
								onPress={() =>
									router.push({
										pathname: "/show/[id]/season/[seasonNumber]",
										params: {
											id,
											seasonNumber: String(seasonNumber),
											title: show?.name || "",
										},
									})
								}
							>
								<Text style={[styles.seasonText, { color: colors.onSurface }]}>
									Season {seasonNumber}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	content: { padding: 16 },
	title: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
	overview: { fontSize: 15, marginBottom: 16, lineHeight: 22 },
	grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
	seasonCard: { borderWidth: 1, borderRadius: 12, padding: 12, minWidth: 140 },
	seasonText: { fontSize: 16, fontWeight: "600" },
});
