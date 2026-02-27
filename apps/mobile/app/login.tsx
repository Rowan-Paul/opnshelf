import { Ionicons } from "@expo/vector-icons";
import { getLoginUrl, getSignupUrl } from "@opnshelf/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Image,
	KeyboardAvoidingView,
	Modal,
	Platform,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3001";

interface ActorSuggestion {
	did: string;
	handle: string;
	displayName: string | null;
	avatar: string | null;
}

export default function LoginScreen() {
	const [handle, setHandle] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [suggestions, setSuggestions] = useState<ActorSuggestion[]>([]);
	const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
	const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
	const [modalInputValue, setModalInputValue] = useState("");
	const router = useRouter();
	const params = useLocalSearchParams<{
		error?: "auth_failed" | "callback_failed";
		redirect?: string;
		reason?: "session_expired";
	}>();
	const { error, redirect, reason } = params;
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { colors } = useTheme();

	const { user, isLoading: isAuthLoading } = useAuth();

	// Open modal when user starts typing
	const handleInputChange = (text: string) => {
		setHandle(text);
		setModalInputValue(text);
	};

	// Close modal and keep current handle value
	const handleCloseModal = () => {
		setShowSuggestionsModal(false);
		setSuggestions([]);
		setIsLoadingSuggestions(false);
	};

	// Fetch suggestions when modalInputValue changes (while modal is open)
	useEffect(() => {
		if (!showSuggestionsModal) return;

		const fetchSuggestions = async () => {
			if (modalInputValue.trim().length < 1) {
				setSuggestions([]);
				return;
			}

			setIsLoadingSuggestions(true);
			try {
				const response = await fetch(
					`${API_URL}/auth/suggestions?q=${encodeURIComponent(modalInputValue.trim())}`,
				);
				if (response.ok) {
					const data = (await response.json()) as ActorSuggestion[];
					setSuggestions(data);
				}
			} catch {
				setSuggestions([]);
			} finally {
				setIsLoadingSuggestions(false);
			}
		};

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(fetchSuggestions, 300);

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [modalInputValue, showSuggestionsModal]);

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

	const handleSelectSuggestion = (actor: ActorSuggestion) => {
		setHandle(actor.handle);
		setShowSuggestionsModal(false);
		setSuggestions([]);
		setIsSubmitting(true);

		const submitWithHandle = async () => {
			try {
				const timezone = detectUserTimezone();
				const loginUrl = getLoginUrl(
					actor.handle,
					timezone || undefined,
					"mobile",
				);

				const result = await WebBrowser.openAuthSessionAsync(
					loginUrl,
					"opnshelf://auth/callback",
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

		submitWithHandle();
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);

		try {
			const timezone = detectUserTimezone();
			const loginUrl = getLoginUrl(
				handle || undefined,
				timezone || undefined,
				"mobile",
			);

			const result = await WebBrowser.openAuthSessionAsync(
				loginUrl,
				"opnshelf://auth/callback",
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
			<View
				style={{
					flex: 1,
					paddingHorizontal: 16,
					paddingTop: 48,
					paddingBottom: 24,
				}}
			>
				<View style={{ flex: 1, justifyContent: "center" }}>
					<View style={{ alignItems: "center", marginBottom: 32 }}>
						<View style={{ marginBottom: 16 }}>
							<Image
								source={require("@/assets/images/icon.png")}
								style={{ width: 64, height: 64, borderRadius: 16 }}
							/>
						</View>
						<Text
							style={{
								fontSize: 28,
								fontWeight: "bold",
								color: colors.onSurface,
								marginBottom: 8,
							}}
						>
							Sign in to OpnShelf
						</Text>
						<Text
							style={{
								fontSize: 16,
								color: colors.onSurfaceVariant,
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
								backgroundColor: `${colors.tertiary}15`,
								borderWidth: 1,
								borderColor: `${colors.tertiary}40`,
								borderRadius: 8,
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
								marginBottom: 24,
								padding: 16,
								backgroundColor: `${colors.error}15`,
								borderWidth: 1,
								borderColor: `${colors.error}40`,
								borderRadius: 8,
								flexDirection: "row",
								alignItems: "flex-start",
								gap: 12,
							}}
						>
							<Ionicons name="alert-circle" size={20} color={colors.error} />
							<Text
								style={{
									color: `${colors.error}dd`,
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
									color: colors.onSurface,
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
									backgroundColor: colors.surfaceContainer,
									borderWidth: 1,
									borderColor: colors.outline,
									borderRadius: 8,
									color: colors.onSurface,
									fontSize: 16,
								}}
								value={handle}
								onChangeText={handleInputChange}
								onFocus={() => {
									setModalInputValue(handle);
									setShowSuggestionsModal(true);
								}}
								placeholder="username.bsky.social"
								placeholderTextColor={colors.onSurfaceVariant}
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
								backgroundColor: isSubmitting
									? `${colors.primary}cc`
									: colors.primary,
								borderRadius: 8,
								opacity: isSubmitting ? 0.7 : 1,
							}}
							onPress={handleSubmit}
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
										Loading
									</Text>
								</>
							) : (
								<>
									<Ionicons name="log-in" size={20} color={colors.onPrimary} />
									<Text
										style={{
											color: colors.onPrimary,
											fontWeight: "600",
											fontSize: 16,
										}}
									>
										Sign in
									</Text>
								</>
							)}
						</TouchableOpacity>

						<Text
							style={{
								textAlign: "center",
								fontSize: 14,
								color: colors.onSurfaceVariant,
							}}
						>
							Don&apos;t have an account?{" "}
							<Text
								style={{
									color: colors.primary,
									textDecorationLine: "underline",
								}}
								onPress={async () => {
									setIsSubmitting(true);
									try {
										const timezone = detectUserTimezone();
										const signupUrl = getSignupUrl(
											timezone || undefined,
											"mobile",
										);

										const result = await WebBrowser.openAuthSessionAsync(
											signupUrl,
											"opnshelf://auth/callback",
										);

										if (result.type === "success") {
											const url = new URL(result.url);
											const session = url.searchParams.get("session");
											if (session) {
												router.replace({
													pathname: "/auth/complete",
													params: { session },
												});
											}
										} else {
											setIsSubmitting(false);
										}
									} catch (err) {
										console.error("Signup auth error:", err);
										setIsSubmitting(false);
									}
								}}
							>
								Create an account
							</Text>
						</Text>
					</View>
				</View>
			</View>

			<Modal
				visible={showSuggestionsModal}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={handleCloseModal}
			>
				<SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
					<View
						style={{
							flexDirection: "row",
							justifyContent: "space-between",
							alignItems: "center",
							paddingHorizontal: 16,
							paddingVertical: 16,
							borderBottomWidth: 1,
							borderBottomColor: colors.outline,
						}}
					>
						<Text
							style={{
								fontSize: 18,
								fontWeight: "600",
								color: colors.onSurface,
							}}
						>
							Find your handle
						</Text>
						<TouchableOpacity onPress={handleCloseModal}>
							<Text
								style={{
									fontSize: 16,
									fontWeight: "500",
									color: colors.primary,
								}}
							>
								Close
							</Text>
						</TouchableOpacity>
					</View>

					<View
						style={{
							paddingHorizontal: 16,
							paddingVertical: 12,
							borderBottomWidth: 1,
							borderBottomColor: colors.outline,
						}}
					>
						<TextInput
							style={{
								width: "100%",
								paddingHorizontal: 16,
								paddingVertical: 12,
								backgroundColor: colors.surfaceContainer,
								borderWidth: 1,
								borderColor: colors.outline,
								borderRadius: 8,
								color: colors.onSurface,
								fontSize: 16,
							}}
							value={modalInputValue}
							onChangeText={setModalInputValue}
							placeholder="Search for your handle..."
							placeholderTextColor={colors.onSurfaceVariant}
							autoCapitalize="none"
							autoCorrect={false}
							autoFocus
						/>
					</View>

					<ScrollView
						style={{
							flex: 1,
							paddingHorizontal: 16,
						}}
					>
						{isLoadingSuggestions ? (
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "center",
									gap: 8,
									padding: 24,
								}}
							>
								<ActivityIndicator
									size="small"
									color={colors.onSurfaceVariant}
								/>
								<Text style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>
									Searching...
								</Text>
							</View>
						) : suggestions.length > 0 ? (
							suggestions.map((item) => (
								<TouchableOpacity
									key={item.did}
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 12,
										padding: 12,
										borderBottomWidth: 1,
										borderBottomColor: colors.outline,
									}}
									onPress={() => handleSelectSuggestion(item)}
								>
									{item.avatar ? (
										<Image
											source={{ uri: item.avatar }}
											style={{ width: 40, height: 40, borderRadius: 20 }}
										/>
									) : (
										<View
											style={{
												width: 40,
												height: 40,
												borderRadius: 20,
												backgroundColor: colors.surfaceContainerHigh,
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											<Text
												style={{
													color: colors.onSurface,
													fontSize: 16,
													fontWeight: "500",
												}}
											>
												{item.handle[0]?.toUpperCase() ?? ""}
											</Text>
										</View>
									)}
									<View style={{ flex: 1 }}>
										<Text
											style={{
												color: colors.onSurface,
												fontWeight: "500",
												fontSize: 16,
											}}
											numberOfLines={1}
										>
											{item.displayName || item.handle}
										</Text>
										<Text
											style={{
												color: colors.onSurfaceVariant,
												fontSize: 14,
												marginTop: 2,
											}}
											numberOfLines={1}
										>
											{item.handle}
										</Text>
									</View>
								</TouchableOpacity>
							))
						) : modalInputValue.trim().length >= 1 ? (
							<View style={{ padding: 24, alignItems: "center" }}>
								<Text style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>
									No handles found
								</Text>
							</View>
						) : null}
					</ScrollView>
				</SafeAreaView>
			</Modal>
		</KeyboardAvoidingView>
	);
}
