import { showsControllerGetShowDetailsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { RefreshControl, ScrollView, View } from "react-native";
import { FullCredits } from "@/components/detail/CreditsSection";
import { useRefreshActiveQueries } from "@/lib/use-refresh";

export default function ShowCreditsScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { data } = useQuery({
		...showsControllerGetShowDetailsOptions({ path: { showId: id } }),
		enabled: Boolean(id),
	});
	const { refreshing, onRefresh } = useRefreshActiveQueries();

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: data?.name ?? "Cast & crew" }}
			/>
			<ScrollView
				className="flex-1"
				contentContainerClassName="pb-12"
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor="#f3bc00"
						colors={["#f3bc00"]}
					/>
				}
			>
				<FullCredits mediaType="show" mediaId={id} />
			</ScrollView>
		</View>
	);
}
