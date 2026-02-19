import {
	authControllerMeOptions,
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
	showsControllerMarkWatchedMutation,
	showsControllerUnmarkWatchedMutation,
	type TmdbEpisodeDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";

export default function ShowEpisodeScreen() {
	const { id, seasonNumber, episodeNumber } = useLocalSearchParams<{
		id: string;
		seasonNumber: string;
		episodeNumber: string;
	}>();
	const { colors } = useTheme();
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const { data } = useQuery({
		...showsControllerGetEpisodeDetailsOptions({
			path: { showId: id, seasonNumber, episodeNumber },
		}),
	});
	const episode = data as TmdbEpisodeDto | undefined;

	const { data: history } = useQuery({
		...showsControllerGetShowWatchHistoryOptions({
			path: { userDid: user?.did || "", showId: id },
		}),
		enabled: !!user?.did,
	});

	const watchedCount =
		history?.filter(
			(h) =>
				h.seasonNumber === Number(seasonNumber) &&
				h.episodeNumber === Number(episodeNumber),
		).length || 0;

	const markMutation = useMutation({
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			showToast("Episode marked watched", "success");
			queryClient.invalidateQueries();
		},
		onError: () => {
			showToast("Failed to mark watched", "error");
		},
	});

	const unmarkMutation = useMutation({
		...showsControllerUnmarkWatchedMutation(),
		onSuccess: () => {
			showToast("Episode unmarked", "success");
			queryClient.invalidateQueries();
		},
		onError: () => {
			showToast("Failed to unmark", "error");
		},
	});

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
		>
			<View style={styles.content}>
				<Text style={[styles.title, { color: colors.onBackground }]}>
					Episode {episodeNumber}
				</Text>
				<Text style={[styles.subtitle, { color: colors.onSurface }]}>
					{episode?.name}
				</Text>
				<Text style={[styles.overview, { color: colors.onSurfaceVariant }]}>
					{episode?.overview || "No overview available."}
				</Text>
				<Text style={[styles.count, { color: colors.onSurfaceVariant }]}>
					Times watched: {watchedCount}
				</Text>
				<View style={styles.actions}>
					<Button
						onPress={() =>
							markMutation.mutate({
								body: {
									showId: id,
									seasonNumber: Number(seasonNumber),
									episodeNumber: Number(episodeNumber),
								},
							})
						}
					>
						<Text style={{ color: colors.onPrimary }}>Mark watched</Text>
					</Button>
					<Button
						variant="outlined"
						onPress={() =>
							unmarkMutation.mutate({
								path: { showId: id },
								query: {
									mode: "all",
									seasonNumber,
									episodeNumber,
								},
							})
						}
					>
						<Text style={{ color: colors.onBackground }}>Unmark episode</Text>
					</Button>
				</View>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	content: { padding: 16 },
	title: { fontSize: 26, fontWeight: "700" },
	subtitle: { fontSize: 18, marginTop: 4, marginBottom: 10 },
	overview: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
	count: { fontSize: 14, marginBottom: 16 },
	actions: { gap: 10 },
});
