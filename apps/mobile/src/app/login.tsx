import { authControllerSuggestionsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { User } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/lib/auth-context";
import { useDebounce } from "@/lib/use-debounce";
import { useTwStyle } from "@/lib/use-tw-style";

type LoginParams = {
	reason?: "session_expired";
};

export default function LoginScreen() {
	const { user, isLoading, isAuthenticated, login } = useAuth();
	const { reason } = useLocalSearchParams<LoginParams>();
	const [handle, setHandle] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const avatarStyle = useTwStyle("size-9");

	const debouncedHandle = useDebounce(handle, 300).trim();
	const suggestionsQuery = useQuery({
		...authControllerSuggestionsOptions({ query: { q: debouncedHandle } }),
		enabled: debouncedHandle.length >= 2,
	});
	const suggestions = suggestionsQuery.data ?? [];
	const showSuggestions = debouncedHandle.length >= 2 && !isSubmitting;

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

					{showSuggestions &&
					(suggestionsQuery.isFetching || suggestions.length > 0) ? (
						<View className="overflow-hidden rounded-lg border border-border bg-card">
							{suggestionsQuery.isFetching ? (
								<View className="flex-row items-center justify-center gap-2 p-4">
									<ActivityIndicator size="small" />
									<Text className="text-muted-foreground text-sm">
										Searching...
									</Text>
								</View>
							) : (
								<ScrollView
									style={{ maxHeight: 232 }}
									keyboardShouldPersistTaps="handled"
								>
									{suggestions.map((actor, index) => (
										<Pressable
											key={actor.did}
											disabled={isSubmitting}
											onPress={() => {
												setHandle(actor.handle);
												submit(() => login(actor.handle));
											}}
											className={`flex-row items-center gap-3 p-3 ${index > 0 ? "border-border border-t" : ""}`}
										>
											<View className="size-9 items-center justify-center overflow-hidden rounded-full bg-background-subtle">
												{actor.avatar ? (
													<Image
														source={{ uri: actor.avatar }}
														style={avatarStyle}
														contentFit="cover"
													/>
												) : (
													<User color="#94a3b8" size={16} />
												)}
											</View>
											<View className="min-w-0 flex-1">
												<Text
													className="font-medium text-foreground text-sm"
													numberOfLines={1}
												>
													{actor.displayName || actor.handle}
												</Text>
												<Text
													className="text-muted-foreground text-xs"
													numberOfLines={1}
												>
													@{actor.handle}
												</Text>
											</View>
										</Pressable>
									))}
								</ScrollView>
							)}
						</View>
					) : null}

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

					<Pressable
						disabled={isSubmitting}
						onPress={() =>
							router.canGoBack() ? router.back() : router.replace("/search")
						}
						className="items-center py-2"
					>
						<Text className="text-muted-foreground text-sm">
							Continue without an account
						</Text>
					</Pressable>
				</View>
			</View>
		</Screen>
	);
}
