import { authControllerMeOptions } from "@opnshelf/api";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePostHog } from "posthog-react-native";
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
	const posthog = usePostHog();

	useEffect(() => {
		async function completeAuth() {
			try {
				if (session) {
					await saveSessionToken(session);
				}

				const user = await queryClient.fetchQuery({
					...authControllerMeOptions(),
					staleTime: 0,
				});

				// Identify the user in PostHog after successful login
				if (user) {
					posthog.identify(user.did, {
						$set: {
							handle: user.handle,
							did: user.did,
						},
						$set_once: {
							first_login_date: new Date().toISOString(),
						},
					});
					posthog.capture("user_logged_in", {
						handle: user.handle,
					});
				}

				await new Promise((resolve) => setTimeout(resolve, 100));

				router.replace("/(tabs)");
			} catch (error) {
				console.error("Auth complete failed:", error);
				showToast("Sign in failed. Please try again.");
				router.replace("/login");
			}
		}

		completeAuth();
	}, [router, queryClient, session, showToast, posthog]);

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
