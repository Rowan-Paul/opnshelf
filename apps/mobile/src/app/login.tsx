import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	TextInput,
	View,
} from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";

type LoginParams = {
	reason?: "session_expired";
};

export default function LoginScreen() {
	const { user, isLoading, isAuthenticated, login } = useAuth();
	const { reason } = useLocalSearchParams<LoginParams>();
	const [handle, setHandle] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Already signed in: let the index gate decide onboarding vs tabs.
	if (!isLoading && isAuthenticated && user) {
		return <Redirect href="/" />;
	}

	const submit = async (action: () => Promise<void>) => {
		if (isSubmitting) {
			return;
		}
		setIsSubmitting(true);
		setError(null);
		try {
			await action();
		} catch (err) {
			console.error("Auth error:", err);
			setError("Sign in failed. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : undefined}
			className="flex-1"
		>
			<Screen>
				<View className="flex-1 justify-center gap-6">
					<View className="gap-2">
						<Text className="font-bold font-display text-4xl text-foreground">
							OpnShelf
						</Text>
						<Text className="text-base text-muted-foreground">
							Sign in with your Atmosphere account.
						</Text>
					</View>

					{reason === "session_expired" && (
						<View className="rounded-lg border border-border bg-muted p-4">
							<Text className="font-semibold text-foreground">
								You were signed out
							</Text>
							<Text className="mt-1 text-muted-foreground text-sm">
								Your session expired. Please sign in again to continue.
							</Text>
						</View>
					)}

					{error && (
						<View className="rounded-lg border border-destructive bg-muted p-4">
							<Text className="text-destructive text-sm">{error}</Text>
						</View>
					)}

					<View className="gap-3">
						<TextInput
							value={handle}
							onChangeText={setHandle}
							placeholder="alice.example.com"
							placeholderTextColor="#94a3b8"
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="go"
							editable={!isSubmitting}
							onSubmitEditing={() => submit(() => login(handle))}
							className="rounded-lg border border-border bg-card px-4 py-3 font-sans text-base text-foreground"
						/>

						<Pressable
							disabled={isSubmitting}
							onPress={() => submit(() => login(handle))}
							className="flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3"
							style={{ opacity: isSubmitting ? 0.7 : 1 }}
						>
							{isSubmitting && (
								<ActivityIndicator size="small" color="#3f2e00" />
							)}
							<Text className="font-semibold text-base text-primary-foreground">
								{isSubmitting ? "Connecting" : "Sign in"}
							</Text>
						</Pressable>

						<Pressable
							disabled={isSubmitting}
							onPress={() => router.push("/signup")}
							className="items-center justify-center rounded-lg border border-border px-4 py-3"
						>
							<Text className="font-semibold text-accent text-base">
								Create a new account
							</Text>
						</Pressable>
					</View>

					<Text className="text-center text-muted-foreground text-sm">
						OpnShelf uses the AT Protocol, so your account moves with you across
						compatible apps.
					</Text>
				</View>
			</Screen>
		</KeyboardAvoidingView>
	);
}
