import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
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
		<Screen>
			<View className="flex-1 justify-center gap-6">
				<View className="items-center gap-4">
					<Image
						source={require("../../assets/images/icon.png")}
						style={{ width: 64, height: 64, borderRadius: 16 }}
					/>
					<View className="items-center gap-1.5">
						<Text className="text-center font-bold font-display text-3xl text-foreground">
							Welcome to Opnshelf
						</Text>
						<Text className="text-center text-base text-muted-foreground">
							Track what you watch with your AT Protocol account
						</Text>
					</View>
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
					<TextField
						label="Your Handle"
						helperText="Enter your Bluesky or AT Protocol handle"
						value={handle}
						onChangeText={setHandle}
						placeholder="username.bsky.social"
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="go"
						editable={!isSubmitting}
						onSubmitEditing={() => submit(() => login(handle))}
					/>

					<Pressable
						disabled={isSubmitting}
						onPress={() => submit(() => login(handle))}
						className="flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3"
						style={{ opacity: isSubmitting ? 0.7 : 1 }}
					>
						{isSubmitting && <ActivityIndicator size="small" color="#3f2e00" />}
						<Text className="font-semibold text-base text-primary-foreground">
							{isSubmitting ? "Connecting..." : "Sign In"}
						</Text>
					</Pressable>

					<Pressable
						disabled={isSubmitting}
						onPress={() => router.push("/signup")}
						className="items-center justify-center rounded-lg border border-border px-4 py-3"
					>
						<Text className="font-semibold text-base text-foreground">
							Create New Account
						</Text>
					</Pressable>
				</View>
			</View>
		</Screen>
	);
}
