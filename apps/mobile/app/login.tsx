import { Ionicons } from "@expo/vector-icons";
import { getLoginUrl } from "@opnshelf/api";
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
				router.replace("/(tabs)/shelf");
			} else if (redirect === "search") {
				router.replace("/(tabs)/search");
			} else {
				router.replace("/(tabs)/shelf");
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
				const loginUrl = `${getLoginUrl(actor.handle, timezone || undefined)}&platform=mobile`;

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
			const loginUrl = `${getLoginUrl(handle || undefined, timezone || undefined)}&platform=mobile`;

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
					backgroundColor: "#030712",
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				<ActivityIndicator size="large" color="#a855f7" />
			</View>
		);
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			style={{ flex: 1, backgroundColor: "#030712" }}
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
								onChangeText={handleInputChange}
								onFocus={() => {
									setModalInputValue(handle);
									setShowSuggestionsModal(true);
								}}
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
									<Text
										style={{
											color: "#ffffff",
											fontWeight: "600",
											fontSize: 16,
										}}
									>
										Redirecting...
									</Text>
								</>
							) : (
								<>
									<Ionicons name="log-in" size={20} color="#fff" />
									<Text
										style={{
											color: "#ffffff",
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
			</View>

			<Modal
				visible={showSuggestionsModal}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={handleCloseModal}
			>
				<SafeAreaView style={modalStyles.container}>
					<View style={modalStyles.header}>
						<Text style={modalStyles.title}>Find your handle</Text>
						<TouchableOpacity onPress={handleCloseModal}>
							<Text style={modalStyles.closeButton}>Close</Text>
						</TouchableOpacity>
					</View>

					<View style={modalStyles.inputContainer}>
						<TextInput
							style={modalStyles.input}
							value={modalInputValue}
							onChangeText={setModalInputValue}
							placeholder="Search for your handle..."
							placeholderTextColor="#6b7280"
							autoCapitalize="none"
							autoCorrect={false}
							autoFocus
						/>
					</View>

					<ScrollView style={modalStyles.suggestionsList}>
						{isLoadingSuggestions ? (
							<View style={modalStyles.loadingContainer}>
								<ActivityIndicator size="small" color="#9ca3af" />
								<Text style={modalStyles.loadingText}>Searching...</Text>
							</View>
						) : suggestions.length > 0 ? (
							suggestions.map((item) => (
								<TouchableOpacity
									key={item.did}
									style={modalStyles.suggestionItem}
									onPress={() => handleSelectSuggestion(item)}
								>
									{item.avatar ? (
										<Image
											source={{ uri: item.avatar }}
											style={modalStyles.avatar}
										/>
									) : (
										<View style={modalStyles.avatarPlaceholder}>
											<Text style={modalStyles.avatarText}>
												{item.handle[0]?.toUpperCase() ?? ""}
											</Text>
										</View>
									)}
									<View style={modalStyles.suggestionTextContainer}>
										<Text
											style={modalStyles.suggestionDisplayName}
											numberOfLines={1}
										>
											{item.displayName || item.handle}
										</Text>
										<Text
											style={modalStyles.suggestionHandle}
											numberOfLines={1}
										>
											{item.handle}
										</Text>
									</View>
								</TouchableOpacity>
							))
						) : modalInputValue.trim().length >= 1 ? (
							<View style={modalStyles.emptyContainer}>
								<Text style={modalStyles.emptyText}>No handles found</Text>
							</View>
						) : null}
					</ScrollView>
				</SafeAreaView>
			</Modal>
		</KeyboardAvoidingView>
	);
}

const modalStyles = {
	container: {
		flex: 1,
		backgroundColor: "#030712",
	},
	header: {
		flexDirection: "row" as const,
		justifyContent: "space-between" as const,
		alignItems: "center" as const,
		paddingHorizontal: 16,
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#374151",
	},
	title: {
		fontSize: 18,
		fontWeight: "600" as const,
		color: "#f9fafb",
	},
	closeButton: {
		fontSize: 16,
		fontWeight: "500" as const,
		color: "#a855f7",
	},
	inputContainer: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#374151",
	},
	input: {
		width: "100%" as const,
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#111827",
		borderWidth: 1,
		borderColor: "#374151",
		borderRadius: 8,
		color: "#ffffff",
		fontSize: 16,
	},
	suggestionsList: {
		flex: 1,
		paddingHorizontal: 16,
	},
	loadingContainer: {
		flexDirection: "row" as const,
		alignItems: "center" as const,
		justifyContent: "center" as const,
		gap: 8,
		padding: 24,
	},
	loadingText: {
		color: "#9ca3af",
		fontSize: 14,
	},
	suggestionItem: {
		flexDirection: "row" as const,
		alignItems: "center" as const,
		gap: 12,
		padding: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#374151",
	},
	avatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
	},
	avatarPlaceholder: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "#4b5563",
		alignItems: "center" as const,
		justifyContent: "center" as const,
	},
	avatarText: {
		color: "#d1d5db",
		fontSize: 16,
		fontWeight: "500" as const,
	},
	suggestionTextContainer: {
		flex: 1,
	},
	suggestionDisplayName: {
		color: "#ffffff",
		fontWeight: "500" as const,
		fontSize: 16,
	},
	suggestionHandle: {
		color: "#9ca3af",
		fontSize: 14,
		marginTop: 2,
	},
	emptyContainer: {
		padding: 24,
		alignItems: "center" as const,
	},
	emptyText: {
		color: "#9ca3af",
		fontSize: 14,
	},
};
