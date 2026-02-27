import { Ionicons } from "@expo/vector-icons";
import { getLoginUrl, getSignupUrl } from "@opnshelf/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Image,
	Keyboard,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { M3TextField } from "@/components/ui/m3";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";

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
	const [showSuggestionsSheet, setShowSuggestionsSheet] = useState(false);
	const [suggestionQuery, setSuggestionQuery] = useState("");
	const [isAboutExpanded, setIsAboutExpanded] = useState(false);
	const [keyboardHeight, setKeyboardHeight] = useState(0);
	const router = useRouter();
	const params = useLocalSearchParams<{
		error?: "auth_failed" | "callback_failed";
		redirect?: string;
		reason?: "session_expired";
	}>();
	const { error, redirect, reason } = params;
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const shownErrorRef = useRef<string | null>(null);
	const { colors } = useTheme();
	const { showToast } = useToast();

	const { user, isLoading: isAuthLoading } = useAuth();

	useEffect(() => {
		if (!showSuggestionsSheet) {
			return;
		}

		const fetchSuggestions = async () => {
			if (suggestionQuery.trim().length < 2) {
				setSuggestions([]);
				return;
			}

			setIsLoadingSuggestions(true);
			try {
				const response = await fetch(
					`${API_URL}/auth/suggestions?q=${encodeURIComponent(suggestionQuery.trim())}`,
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
	}, [showSuggestionsSheet, suggestionQuery]);

	useEffect(() => {
		if (!showSuggestionsSheet) {
			setKeyboardHeight(0);
			return;
		}

		const showEvent =
			Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent =
			Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

		const showSubscription = Keyboard.addListener(showEvent, (event) => {
			setKeyboardHeight(event.endCoordinates.height);
		});
		const hideSubscription = Keyboard.addListener(hideEvent, () => {
			setKeyboardHeight(0);
		});

		return () => {
			showSubscription.remove();
			hideSubscription.remove();
		};
	}, [showSuggestionsSheet]);

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
		setShowSuggestionsSheet(false);

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

	const openSuggestionsSheet = () => {
		setSuggestionQuery(handle);
		setShowSuggestionsSheet(true);
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
								<Text
									style={{
										fontSize: 12,
										fontWeight: "600",
										letterSpacing: 1.2,
										textTransform: "uppercase",
										color: colors.onSurfaceVariant,
										marginBottom: 8,
									}}
								>
									Handle
								</Text>
								<TouchableOpacity
									onPress={openSuggestionsSheet}
									disabled={isSubmitting}
									activeOpacity={0.8}
									style={{
										width: "100%",
										paddingHorizontal: 14,
										paddingVertical: 13,
										backgroundColor: colors.surfaceContainer,
										borderWidth: 1,
										borderColor: colors.outline,
										borderRadius: 10,
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "space-between",
									}}
								>
									<Text
										style={{
											color:
												handle.trim().length > 0
													? colors.onSurface
													: colors.onSurfaceVariant,
											fontSize: 17,
										}}
									>
										{handle.trim().length > 0 ? handle : "alice.example.com"}
									</Text>
									<Ionicons
										name="chevron-down"
										size={18}
										color={colors.onSurfaceVariant}
									/>
								</TouchableOpacity>
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

			<Modal
				visible={showSuggestionsSheet}
				animationType="slide"
				transparent
				onRequestClose={() => setShowSuggestionsSheet(false)}
			>
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === "ios" ? "padding" : undefined}
				>
					<Pressable
						style={{
							flex: 1,
							backgroundColor: "rgba(0, 0, 0, 0.45)",
							justifyContent: "flex-end",
						}}
						onPress={() => setShowSuggestionsSheet(false)}
					>
						<Pressable
							onPress={(event) => event.stopPropagation()}
							style={{
								maxHeight: keyboardHeight > 0 ? "80%" : "60%",
								marginBottom: Platform.OS === "android" ? keyboardHeight : 0,
								borderTopLeftRadius: 20,
								borderTopRightRadius: 20,
								backgroundColor: colors.surface,
								paddingTop: 12,
								paddingBottom: 24,
								borderTopWidth: 1,
								borderColor: colors.outlineVariant,
							}}
						>
							<View
								style={{
									alignItems: "center",
									marginBottom: 14,
								}}
							>
								<View
									style={{
										width: 40,
										height: 4,
										borderRadius: 999,
										backgroundColor: colors.outline,
									}}
								/>
							</View>

							<View
								style={{
									paddingHorizontal: 16,
									marginBottom: 10,
									flexDirection: "row",
									justifyContent: "space-between",
									alignItems: "center",
								}}
							>
								<Text
									style={{
										fontSize: 18,
										fontWeight: "600",
										color: colors.onSurface,
									}}
								>
									Account suggestions
								</Text>
								<TouchableOpacity
									onPress={() => setShowSuggestionsSheet(false)}
								>
									<Text style={{ color: colors.primary, fontSize: 15 }}>
										Done
									</Text>
								</TouchableOpacity>
							</View>

							<View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
								<M3TextField
									label="Handle"
									containerStyle={{ width: "100%" }}
									value={suggestionQuery}
									onChangeText={setSuggestionQuery}
									placeholder="Search by handle"
									autoCapitalize="none"
									autoCorrect={false}
									autoFocus
									variant="outlined"
								/>
							</View>

							<ScrollView
								style={{ paddingHorizontal: 16 }}
								contentContainerStyle={{ paddingBottom: 12 }}
								keyboardShouldPersistTaps="handled"
							>
								{isLoadingSuggestions ? (
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											justifyContent: "center",
											gap: 8,
											paddingVertical: 20,
										}}
									>
										<ActivityIndicator
											size="small"
											color={colors.onSurfaceVariant}
										/>
										<Text
											style={{ color: colors.onSurfaceVariant, fontSize: 14 }}
										>
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
												paddingVertical: 12,
												borderBottomWidth: 1,
												borderBottomColor: colors.outlineVariant,
											}}
											onPress={() => {
												setHandle(item.handle);
												void startLogin(item.handle);
											}}
										>
											{item.avatar ? (
												<Image
													source={{ uri: item.avatar }}
													style={{ width: 38, height: 38, borderRadius: 19 }}
												/>
											) : (
												<View
													style={{
														width: 38,
														height: 38,
														borderRadius: 19,
														backgroundColor: colors.surfaceContainerHigh,
														alignItems: "center",
														justifyContent: "center",
													}}
												>
													<Text
														style={{
															color: colors.onSurface,
															fontWeight: "600",
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
														fontSize: 16,
														fontWeight: "500",
													}}
													numberOfLines={1}
												>
													{item.displayName || item.handle}
												</Text>
												<Text
													style={{
														color: colors.onSurfaceVariant,
														fontSize: 13,
														marginTop: 2,
													}}
													numberOfLines={1}
												>
													{item.handle}
												</Text>
											</View>
										</TouchableOpacity>
									))
								) : suggestionQuery.trim().length >= 2 ? (
									<View style={{ paddingVertical: 18 }}>
										<Text
											style={{
												color: colors.onSurfaceVariant,
												fontSize: 14,
												textAlign: "center",
											}}
										>
											No accounts found. Keep typing or enter your handle
											manually.
										</Text>
									</View>
								) : (
									<View style={{ paddingVertical: 18 }}>
										<Text
											style={{
												color: colors.onSurfaceVariant,
												fontSize: 14,
												textAlign: "center",
											}}
										>
											Type at least 2 characters to see suggestions.
										</Text>
									</View>
								)}
							</ScrollView>

							<View
								style={{
									paddingHorizontal: 16,
									paddingTop: 10,
									borderTopWidth: 1,
									borderTopColor: colors.outlineVariant,
								}}
							>
								<TouchableOpacity
									onPress={() => {
										if (!suggestionQuery.trim()) {
											return;
										}
										const selectedHandle = suggestionQuery.trim();
										setHandle(selectedHandle);
										void startLogin(selectedHandle);
									}}
									disabled={!suggestionQuery.trim()}
									style={{
										paddingVertical: 12,
										paddingHorizontal: 12,
										borderWidth: 1,
										borderColor: colors.outlineVariant,
										borderRadius: 10,
										backgroundColor: colors.surfaceContainerLow,
										opacity: suggestionQuery.trim() ? 1 : 0.6,
									}}
									activeOpacity={0.8}
								>
									<Text
										style={{
											color: colors.primary,
											fontSize: 15,
											fontWeight: "600",
										}}
									>
										{suggestionQuery.trim()
											? `Use "${suggestionQuery.trim()}" as my handle`
											: "Type a handle to continue"}
									</Text>
								</TouchableOpacity>
							</View>
						</Pressable>
					</Pressable>
				</KeyboardAvoidingView>
			</Modal>
		</KeyboardAvoidingView>
	);
}
