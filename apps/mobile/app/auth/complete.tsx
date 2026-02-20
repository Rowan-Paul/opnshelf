import { Ionicons } from "@expo/vector-icons";
import { authControllerMeOptions } from "@opnshelf/api";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
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

			await queryClient.fetchQuery({
				...authControllerMeOptions(),
				staleTime: 0,
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			router.replace("/(tabs)");
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
			<Ionicons name="film" size={48} color="#F59E0B" />
			<ActivityIndicator
				size="large"
				color="#F59E0B"
				style={{ marginVertical: 16 }}
			/>
			<Text style={{ color: "#9ca3af" }}>Completing sign-in...</Text>
		</View>
	);
}
