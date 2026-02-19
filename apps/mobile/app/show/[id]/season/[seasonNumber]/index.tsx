import {
	showsControllerGetSeasonDetailsOptions,
	type TmdbSeasonDetailDto,
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

export default function ShowSeasonScreen() {
	const { id, seasonNumber, title } = useLocalSearchParams<{
		id: string;
		seasonNumber: string;
		title?: string;
	}>();
	const router = useRouter();
	const { colors } = useTheme();

	const { data } = useQuery({
		...showsControllerGetSeasonDetailsOptions({
			path: { showId: id, seasonNumber },
		}),
	});
	const season = data as TmdbSeasonDetailDto | undefined;

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
		>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={[styles.title, { color: colors.onBackground }]}>
					{title}
				</Text>
				<Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
					Season {seasonNumber}
				</Text>
				<View style={styles.list}>
					{(season?.episodes || []).map((episode) => (
						<TouchableOpacity
							key={episode.id}
							style={[
								styles.episodeCard,
								{
									borderColor: colors.outline,
									backgroundColor: colors.surfaceContainer,
								},
							]}
							onPress={() =>
								router.push({
									pathname:
										"/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
									params: {
										id,
										seasonNumber,
										episodeNumber: String(episode.episode_number),
										title: title || "",
									},
								})
							}
						>
							<Text style={[styles.episodeTitle, { color: colors.onSurface }]}>
								Episode {episode.episode_number}
							</Text>
							<Text
								style={[styles.episodeName, { color: colors.onSurfaceVariant }]}
							>
								{episode.name}
							</Text>
						</TouchableOpacity>
					))}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	content: { padding: 16 },
	title: { fontSize: 24, fontWeight: "700" },
	subtitle: { fontSize: 16, marginTop: 4, marginBottom: 16 },
	list: { gap: 10 },
	episodeCard: { borderWidth: 1, borderRadius: 12, padding: 12 },
	episodeTitle: { fontSize: 16, fontWeight: "600" },
	episodeName: { fontSize: 14, marginTop: 4 },
});
