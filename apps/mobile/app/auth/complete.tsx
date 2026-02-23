import { authControllerMeOptions } from "@opnshelf/api";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { useToast } from "@/contexts/toast";
import { saveSessionToken } from "@/lib/api";

export default function AuthCompleteScreen() {
	const queryClient = useQueryClient();
	const router = useRouter();
	const params = useLocalSearchParams<{ session?: string }>();
	const { session } = params;
	const { showToast } = useToast();

	useEffect(() => {
		async function completeAuth() {
			try {
				if (session) {
					await saveSessionToken(session);
				}

				await queryClient.fetchQuery({
					...authControllerMeOptions(),
					staleTime: 0,
				});

				await new Promise((resolve) => setTimeout(resolve, 100));

				router.replace("/(tabs)");
			} catch (error) {
				console.error("Auth complete failed:", error);
				showToast("Sign in failed. Please try again.");
				router.replace("/login");
			}
		}

		completeAuth();
	}, [router, queryClient, session, showToast]);

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
			<Image
				source={require("@/assets/images/icon.png")}
				style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 16 }}
			/>
			<ActivityIndicator
				size="large"
				color="#F59E0B"
				style={{ marginVertical: 16 }}
			/>
			<Text style={{ color: "#9ca3af" }}>Completing sign-in...</Text>
		</View>
	);
}
