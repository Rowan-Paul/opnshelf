import { Ionicons } from "@expo/vector-icons";
import {
	authControllerMeOptions,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { saveSessionToken } from "@/lib/api";

function detectUserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "UTC";
	}
}

function detectUserTimeFormat(): "12h" | "24h" {
	try {
		const hour12 = Intl.DateTimeFormat().resolvedOptions().hour12;
		return hour12 ? "12h" : "24h";
	} catch {
		return "24h";
	}
}

export default function AuthCompleteScreen() {
	const queryClient = useQueryClient();
	const router = useRouter();
	const params = useLocalSearchParams<{ session?: string }>();
	const { session } = params;

	const updateSettings = useMutation({
		...usersControllerUpdateMySettingsMutation(),
	});

	const { data: userSettings } = useQuery({
		...usersControllerGetMySettingsOptions(),
	});

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

			router.replace("/(tabs)/shelf");
		}

		completeAuth();
	}, [router, queryClient, session]);

	useEffect(() => {
		if (!userSettings) return;

		const detectedTimezone = detectUserTimezone();
		const detectedTimeFormat = detectUserTimeFormat();

		if (
			userSettings.timezone === "UTC" &&
			(detectedTimezone !== "UTC" || userSettings.timeFormat === "24h")
		) {
			updateSettings.mutate({
				body: {
					timezone: detectedTimezone,
					timeFormat: detectedTimeFormat,
				},
			});
		}
	}, [userSettings, updateSettings]);

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
			<ActivityIndicator
				size="large"
				color="#a855f7"
				style={{ marginVertical: 16 }}
			/>
			<Text style={{ color: "#9ca3af" }}>Completing sign-in...</Text>
		</View>
	);
}
