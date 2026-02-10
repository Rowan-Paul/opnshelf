import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { authControllerMeOptions } from "@opnshelf/api";
import { saveSessionToken } from "@/lib/api";

export default function AuthCompleteScreen() {
	const queryClient = useQueryClient();
	const router = useRouter();
	const params = useLocalSearchParams<{ session?: string }>();
	const { session } = params;

	useEffect(() => {
		async function completeAuth() {
			if (session) {
				await saveSessionToken(session);
			}

			// Refetch auth query and wait for it to complete
			await queryClient.fetchQuery({
				...authControllerMeOptions(),
				staleTime: 0,
			});

			// Small delay to ensure state is propagated
			await new Promise((resolve) => setTimeout(resolve, 100));

			router.replace("/(tabs)/shelf");
		}

		completeAuth();
	}, [router, queryClient, session]);

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: "#030712",
				justifyContent: "center",
				alignItems: "center",
				padding: 16,
			}}
		>
			<Ionicons name="film" size={48} color="#a855f7" />
			<ActivityIndicator size="large" color="#a855f7" style={{ marginVertical: 16 }} />
			<Text style={{ color: "#9ca3af" }}>Completing sign-in...</Text>
		</View>
	);
}
