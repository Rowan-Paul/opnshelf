import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter, useLocalSearchParams } from "expo-router";
import { authControllerMeOptions, getLoginUrl } from "@opnshelf/api";

export default function LoginScreen() {
	const [handle, setHandle] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const router = useRouter();
	const params = useLocalSearchParams<{
		error?: "auth_failed" | "callback_failed";
		redirect?: string;
		reason?: "session_expired";
	}>();
	const { error, redirect, reason } = params;

	const { data: user, isLoading: isAuthLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	useEffect(() => {
		if (user && !isAuthLoading) {
			if (redirect === "shelf") {
				router.replace("/(tabs)/shelf");
			} else if (redirect === "search") {
				router.replace("/(tabs)/search");
			} else {
				router.replace("/(tabs)/shelf");
			}
		}
	}, [user, isAuthLoading, router, redirect]);

	const handleSubmit = async () => {
		setIsSubmitting(true);

		try {
			const loginUrl = `${getLoginUrl(handle || undefined)}&platform=mobile`;

			const result = await WebBrowser.openAuthSessionAsync(
				loginUrl,
				"opnshelf://auth/callback"
			);

			if (result.type === "success") {
				const url = new URL(result.url);
				const session = url.searchParams.get("session");
				if (session) {
					router.replace({ pathname: "/auth/complete", params: { session } });
				}
			} else {
				setIsSubmitting(false);
			}
		} catch (err) {
			console.error("Auth error:", err);
			setIsSubmitting(false);
		}
	};

	const errorMessages: Record<string, string> = {
		auth_failed: "Authentication failed. Please try again.",
		callback_failed: "Something went wrong during sign in. Please try again.",
	};

	if (isAuthLoading) {
		return (
			<View style={{ flex: 1, backgroundColor: "#030712", justifyContent: "center", alignItems: "center" }}>
				<ActivityIndicator size="large" color="#a855f7" />
			</View>
		);
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			style={{ flex: 1, backgroundColor: "#030712" }}
		>
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{
					flexGrow: 1,
					paddingHorizontal: 16,
					paddingTop: 48,
					paddingBottom: 24,
				}}
				keyboardShouldPersistTaps="handled"
			>
				<View style={{ flex: 1, justifyContent: "center" }}>
					<View style={{ alignItems: "center", marginBottom: 32 }}>
						<View style={{ marginBottom: 16 }}>
							<Ionicons name="film" size={48} color="#8b5cf6" />
						</View>
						<Text
							style={{
								fontSize: 28,
								fontWeight: "bold",
								color: "#f9fafb",
								marginBottom: 8,
							}}
						>
							Sign in to OpnShelf
						</Text>
						<Text
							style={{
								fontSize: 16,
								color: "#9ca3af",
								textAlign: "center",
							}}
						>
							Use your ATProto account to sign in
						</Text>
					</View>

					{reason === "session_expired" && (
						<View
							style={{
								marginBottom: 24,
								padding: 16,
								backgroundColor: "rgba(251, 191, 36, 0.1)",
								borderWidth: 1,
								borderColor: "rgba(251, 191, 36, 0.3)",
								borderRadius: 8,
							}}
						>
							<Text
								style={{
									color: "#fcd34d",
									fontWeight: "600",
									marginBottom: 4,
								}}
							>
								You have been logged out
							</Text>
							<Text style={{ color: "rgba(252, 211, 77, 0.8)", fontSize: 14 }}>
								Your session has expired. Please sign in again to continue.
							</Text>
						</View>
					)}

					{error && (
						<View
							style={{
								marginBottom: 24,
								padding: 16,
								backgroundColor: "rgba(239, 68, 68, 0.1)",
								borderWidth: 1,
								borderColor: "rgba(239, 68, 68, 0.3)",
								borderRadius: 8,
								flexDirection: "row",
								alignItems: "flex-start",
								gap: 12,
							}}
						>
							<Ionicons name="alert-circle" size={20} color="#f87171" />
							<Text
								style={{
									color: "#fecaca",
									fontSize: 14,
									flex: 1,
								}}
							>
								{errorMessages[error] || "An error occurred. Please try again."}
							</Text>
						</View>
					)}

					<View style={{ gap: 24 }}>
						<View>
							<Text
								style={{
									fontSize: 14,
									fontWeight: "500",
									color: "#d1d5db",
									marginBottom: 8,
								}}
							>
								Handle
							</Text>
							<TextInput
								style={{
									width: "100%",
									paddingHorizontal: 16,
									paddingVertical: 12,
									backgroundColor: "#111827",
									borderWidth: 1,
									borderColor: "#374151",
									borderRadius: 8,
									color: "#ffffff",
									fontSize: 16,
								}}
								value={handle}
								onChangeText={setHandle}
								placeholder="username.bsky.social"
								placeholderTextColor="#6b7280"
								autoCapitalize="none"
								autoCorrect={false}
								keyboardType="email-address"
								editable={!isSubmitting}
							/>
						</View>

						<TouchableOpacity
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "center",
								gap: 8,
								paddingHorizontal: 16,
								paddingVertical: 12,
								backgroundColor: isSubmitting ? "#5b21b6" : "#7c3aed",
								borderRadius: 8,
								opacity: isSubmitting ? 0.7 : 1,
							}}
							onPress={handleSubmit}
							disabled={isSubmitting}
							activeOpacity={0.8}
						>
							{isSubmitting ? (
								<>
									<ActivityIndicator size="small" color="#fff" />
									<Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 16 }}>
										Redirecting...
									</Text>
								</>
							) : (
								<>
									<Ionicons name="log-in" size={20} color="#fff" />
									<Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 16 }}>
										Sign in
									</Text>
								</>
							)}
						</TouchableOpacity>

						<Text
							style={{
								textAlign: "center",
								fontSize: 14,
								color: "#9ca3af",
							}}
						>
							Don&apos;t have an account?{" "}
							<Text
								style={{
									color: "#8b5cf6",
									textDecorationLine: "underline",
								}}
								onPress={() => {}}
							>
								Sign up on Bluesky
							</Text>
						</Text>
					</View>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}
