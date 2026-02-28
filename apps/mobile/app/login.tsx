import { Ionicons } from "@expo/vector-icons";
import { getLoginUrl, getSignupUrl } from "@opnshelf/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { M3TextField } from "@/components/ui/m3";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";

export default function LoginScreen() {
	const [handle, setHandle] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isAboutExpanded, setIsAboutExpanded] = useState(false);
	const router = useRouter();
	const params = useLocalSearchParams<{
		error?: "auth_failed" | "callback_failed";
		redirect?: string;
		reason?: "session_expired";
	}>();
	const { error, redirect, reason } = params;
	const shownErrorRef = useRef<string | null>(null);
	const { colors } = useTheme();
	const { showToast } = useToast();

	const { user, isLoading: isAuthLoading } = useAuth();

	useEffect(() => {
		if (user && !isAuthLoading) {
			if (redirect === "shelf") {
				router.replace("/(tabs)");
			} else if (redirect === "search") {
				router.replace("/(tabs)/search");
			} else {
				router.replace("/(tabs)");
			}
		}
	}, [user, isAuthLoading, router, redirect]);

	const detectUserTimezone = (): string => {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone;
		} catch {
			return "";
		}
	};

	const completeAuthSession = async (authUrl: string) => {
		const result = await WebBrowser.openAuthSessionAsync(
			authUrl,
			"opnshelf://auth/callback",
		);

		if (result.type !== "success") {
			setIsSubmitting(false);
			showToast("Sign in failed. Please try again.");
			return;
		}

		const url = new URL(result.url);
		const session = url.searchParams.get("session");
		if (!session) {
			setIsSubmitting(false);
			showToast("Sign in failed. Please try again.");
			return;
		}

		router.replace({ pathname: "/auth/complete", params: { session } });
	};

	const startLogin = async (loginHandle?: string) => {
		setIsSubmitting(true);

		try {
			const timezone = detectUserTimezone();
			const loginUrl = getLoginUrl(
				loginHandle || undefined,
				timezone || undefined,
				"mobile",
			);
			await completeAuthSession(loginUrl);
		} catch (err) {
			console.error("Auth error:", err);
			setIsSubmitting(false);
		}
	};

	const handleSignup = async () => {
		setIsSubmitting(true);
		try {
			const timezone = detectUserTimezone();
			const signupUrl = getSignupUrl(timezone || undefined, "mobile");
			await completeAuthSession(signupUrl);
		} catch (err) {
			console.error("Signup auth error:", err);
			setIsSubmitting(false);
		}
	};

	const errorMessages: Record<string, string> = {
		auth_failed: "Authentication failed. Please try again.",
		callback_failed: "Something went wrong during sign in. Please try again.",
	};

	useEffect(() => {
		if (!error) {
			shownErrorRef.current = null;
			return;
		}
		if (shownErrorRef.current === error) {
			return;
		}
		shownErrorRef.current = error;
		showToast(errorMessages[error] || "An error occurred. Please try again.");
	}, [error, showToast]);

	if (isAuthLoading) {
		return (
			<View
				style={{
					flex: 1,
					backgroundColor: colors.background,
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				<ActivityIndicator size="large" color={colors.primary} />
			</View>
		);
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			style={{ flex: 1, backgroundColor: colors.background }}
		>
			<SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
				<View
					style={{
						flex: 1,
						paddingHorizontal: 16,
						paddingTop: 24,
						paddingBottom: 24,
						justifyContent: "center",
					}}
				>
					<View
						style={{
							borderRadius: 16,
							padding: 20,
							borderWidth: 1,
							borderColor: colors.outlineVariant,
							backgroundColor: colors.surface,
						}}
					>
						<View style={{ marginBottom: 24 }}>
							<Text
								style={{
									fontSize: 32,
									fontWeight: "700",
									color: colors.onSurface,
									marginBottom: 12,
								}}
							>
								Login
							</Text>
							<Text
								style={{
									fontSize: 18,
									lineHeight: 26,
									color: colors.onSurfaceVariant,
								}}
							>
								Connect with your Atmosphere account
							</Text>
						</View>

						{reason === "session_expired" && (
							<View
								style={{
									marginBottom: 18,
									padding: 14,
									backgroundColor: `${colors.tertiary}15`,
									borderWidth: 1,
									borderColor: `${colors.tertiary}40`,
									borderRadius: 10,
								}}
							>
								<Text
									style={{
										color: colors.tertiary,
										fontWeight: "600",
										marginBottom: 4,
									}}
								>
									You have been logged out
								</Text>
								<Text style={{ color: `${colors.tertiary}cc`, fontSize: 14 }}>
									Your session has expired. Please sign in again to continue.
								</Text>
							</View>
						)}

						{error && (
							<View
								style={{
									marginBottom: 18,
									padding: 14,
									backgroundColor: `${colors.error}15`,
									borderWidth: 1,
									borderColor: `${colors.error}40`,
									borderRadius: 10,
									flexDirection: "row",
									alignItems: "flex-start",
									gap: 10,
								}}
							>
								<Ionicons name="alert-circle" size={18} color={colors.error} />
								<Text
									style={{
										color: `${colors.error}dd`,
										fontSize: 14,
										lineHeight: 20,
										flex: 1,
									}}
								>
									{errorMessages[error] ||
										"An error occurred. Please try again."}
								</Text>
							</View>
						)}

						<View style={{ gap: 14 }}>
							<View>
								<M3TextField
									label="Handle"
									containerStyle={{ width: "100%" }}
									value={handle}
									onChangeText={setHandle}
									placeholder="alice.example.com"
									autoCapitalize="none"
									autoCorrect={false}
									editable={!isSubmitting}
									variant="outlined"
								/>
							</View>

							<View
								style={{
									borderRadius: 10,
									borderWidth: 1,
									borderColor: colors.outlineVariant,
									backgroundColor: colors.surfaceContainerLow,
									paddingHorizontal: 12,
									paddingVertical: 10,
								}}
							>
								<TouchableOpacity
									onPress={() => setIsAboutExpanded((value) => !value)}
									activeOpacity={0.8}
									style={{
										flexDirection: "row",
										justifyContent: "space-between",
										alignItems: "center",
									}}
								>
									<Text
										style={{
											fontSize: 16,
											color: colors.onSurface,
										}}
									>
										What is an Atmosphere account?
									</Text>
									<Ionicons
										name={isAboutExpanded ? "chevron-up" : "chevron-down"}
										size={18}
										color={colors.onSurfaceVariant}
									/>
								</TouchableOpacity>
								{isAboutExpanded && (
									<Text
										style={{
											marginTop: 10,
											fontSize: 14,
											lineHeight: 20,
											color: colors.onSurfaceVariant,
										}}
									>
										Atmosphere uses the AT Protocol, so your account can move
										with you. You can sign in across compatible apps while
										keeping control of your identity and data. For example, you
										can sign in to Bluesky with your OpnShelf account and vice
										versa.
									</Text>
								)}
							</View>

							<TouchableOpacity
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "center",
									gap: 8,
									paddingHorizontal: 16,
									paddingVertical: 12,
									backgroundColor: isSubmitting
										? `${colors.primary}cc`
										: colors.primary,
									borderRadius: 10,
									opacity: isSubmitting ? 0.7 : 1,
								}}
								onPress={() => {
									void startLogin(handle || undefined);
								}}
								disabled={isSubmitting}
								activeOpacity={0.8}
							>
								{isSubmitting ? (
									<>
										<ActivityIndicator size="small" color={colors.onPrimary} />
										<Text
											style={{
												color: colors.onPrimary,
												fontWeight: "600",
												fontSize: 16,
											}}
										>
											Connecting
										</Text>
									</>
								) : (
									<Text
										style={{
											color: colors.onPrimary,
											fontWeight: "600",
											fontSize: 16,
										}}
									>
										Connect
									</Text>
								)}
							</TouchableOpacity>

							<TouchableOpacity
								onPress={() => {
									void handleSignup();
								}}
								disabled={isSubmitting}
								activeOpacity={0.8}
								style={{
									paddingHorizontal: 16,
									paddingVertical: 12,
									borderRadius: 10,
									borderWidth: 1,
									borderColor: colors.outlineVariant,
									alignItems: "center",
								}}
							>
								<Text
									style={{
										color: colors.primary,
										fontWeight: "600",
										fontSize: 16,
									}}
								>
									Create a new account
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</SafeAreaView>
		</KeyboardAvoidingView>
	);
}
