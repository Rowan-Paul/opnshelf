import {
	authControllerMeQueryKey,
	type UserDto,
	usersControllerCompleteOnboarding,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";

export default function OnboardingScreen() {
	const { user, isLoading, isAuthenticated } = useAuth();
	const queryClient = useQueryClient();

	const completeOnboarding = useMutation({
		mutationKey: ["auth", "completeOnboarding"],
		mutationFn: async () => {
			const { data } = await usersControllerCompleteOnboarding({
				throwOnError: true,
			});
			return data;
		},
		onSuccess: (data) => {
			const meKey = authControllerMeQueryKey();
			// Optimistically flip needsOnboarding so the gate lets the user through.
			queryClient.setQueryData(meKey, (old: UserDto | undefined) =>
				old
					? {
							...old,
							onboardingCompletedAt:
								data?.onboardingCompletedAt ?? old.onboardingCompletedAt,
							needsOnboarding: false,
						}
					: old,
			);
			queryClient.invalidateQueries({ queryKey: meKey });
			router.replace("/");
		},
	});

	// Not authenticated -> login; already onboarded -> tabs.
	if (!isLoading && !isAuthenticated) {
		return <Redirect href="/login" />;
	}
	if (!isLoading && user?.needsEmailVerification) {
		return <Redirect href="/verify-email" />;
	}
	if (!isLoading && user && !user.needsOnboarding) {
		return <Redirect href="/" />;
	}

	const isSubmitting = completeOnboarding.isPending;

	return (
		<Screen>
			<View className="flex-1 justify-center gap-6">
				<View className="gap-2">
					<Text className="font-bold font-display text-4xl text-foreground">
						Welcome to OpnShelf
					</Text>
					<Text className="text-base text-muted-foreground">
						Track what you watch and read, keep it all on your own Atmosphere
						account, and share it however you like.
					</Text>
				</View>

				<Text className="text-muted-foreground text-sm">
					You can import your history from Trakt later in Settings.
				</Text>

				<Pressable
					disabled={isSubmitting}
					onPress={() => completeOnboarding.mutate()}
					className="flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3"
					style={{ opacity: isSubmitting ? 0.7 : 1 }}
				>
					{isSubmitting && <ActivityIndicator size="small" color="#3f2e00" />}
					<Text className="font-semibold text-base text-primary-foreground">
						{isSubmitting ? "Setting up" : "Get started"}
					</Text>
				</Pressable>

				{completeOnboarding.isError && (
					<Text className="text-center text-destructive text-sm">
						Something went wrong. Please try again.
					</Text>
				)}
			</View>
		</Screen>
	);
}
