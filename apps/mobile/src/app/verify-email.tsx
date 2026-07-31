import {
	authControllerMeQueryKey,
	authControllerResendVerification,
	authControllerVerifyEmail,
	type UserDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { MailCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { posthog } from "@/lib/posthog";

const RESEND_COOLDOWN_SECONDS = 60;

/** Pull a human-readable message out of a NestJS error body (string or string[]). */
function extractErrorMessage(error: unknown, fallback: string): string {
	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		if (Array.isArray(message)) return message.join(", ");
		if (typeof message === "string" && message.length > 0) return message;
	}
	return fallback;
}

export default function VerifyEmailScreen() {
	const { user, isLoading, isAuthenticated, runAuthorizationUrl } = useAuth();
	const queryClient = useQueryClient();
	const toast = useToast();
	const [code, setCode] = useState("");
	const [cooldown, setCooldown] = useState(0);

	useEffect(() => {
		if (cooldown <= 0) return;
		const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
		return () => clearTimeout(timer);
	}, [cooldown]);

	const verifyMutation = useMutation({
		mutationKey: ["auth", "verify-email"],
		mutationFn: async (verificationCode: string) => {
			const { data } = await authControllerVerifyEmail({
				body: { code: verificationCode },
				throwOnError: true,
			});
			return data;
		},
		onSuccess: async (result) => {
			posthog?.capture("email_verified", { platform: "mobile" });
			// The credential session was bootstrap-only and is now revoked. Re-enter
			// via the regular Core OAuth flow before onboarding can write records.
			if (result?.coreOAuthUrl) {
				await runAuthorizationUrl(result.coreOAuthUrl);
				return;
			}
			const meKey = authControllerMeQueryKey();
			// Optimistically clear the gate so the redirect below fires immediately;
			// the invalidate then refetches the authoritative record.
			queryClient.setQueryData(meKey, (old: UserDto | undefined) =>
				old
					? {
							...old,
							emailVerifiedAt: old.emailVerifiedAt ?? new Date().toISOString(),
							needsEmailVerification: false,
						}
					: old,
			);
			await queryClient.invalidateQueries({ queryKey: meKey });
		},
		onError: (error) => {
			toast.error(
				extractErrorMessage(error, "Could not verify that code. Try again."),
			);
		},
	});

	const resendMutation = useMutation({
		mutationKey: ["auth", "resend-verification"],
		mutationFn: async () => {
			await authControllerResendVerification({ throwOnError: true });
		},
		onSuccess: () => {
			setCooldown(RESEND_COOLDOWN_SECONDS);
			toast.success("We've sent a fresh code to your email.");
		},
		onError: (error) => {
			toast.error(
				extractErrorMessage(error, "Could not resend the code. Try again."),
			);
		},
	});

	// Not signed in -> login. Already verified -> let the index gate route us on
	// to onboarding or the app.
	if (!isLoading && !isAuthenticated) {
		return <Redirect href="/login" />;
	}
	if (!isLoading && user && !user.needsEmailVerification) {
		return <Redirect href="/" />;
	}

	const isSubmitting = verifyMutation.isPending;
	const trimmedCode = code.trim();

	const handleSubmit = () => {
		if (isSubmitting || !trimmedCode) return;
		verifyMutation.mutate(trimmedCode);
	};

	return (
		<Screen>
			<View className="flex-1 justify-center gap-6">
				<View className="items-center gap-4">
					<View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
						<MailCheck color="#3f2e00" size={32} />
					</View>
					<Text className="text-center font-bold font-display text-3xl text-foreground">
						Verify your email
					</Text>
					<Text className="text-center text-base text-muted-foreground">
						We sent a verification code to the email you signed up with. Enter
						it below to finish setting up{" "}
						{user?.handle ? `@${user.handle}` : "your account"}.
					</Text>
				</View>

				<View className="gap-3">
					<TextField
						value={code}
						onChangeText={setCode}
						placeholder="Paste the code from your email"
						autoCapitalize="none"
						autoCorrect={false}
						autoComplete="sms-otp"
						textContentType="oneTimeCode"
						returnKeyType="go"
						editable={!isSubmitting}
						onSubmitEditing={handleSubmit}
					/>

					<Pressable
						disabled={isSubmitting || !trimmedCode}
						onPress={handleSubmit}
						className="flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3"
						style={{ opacity: isSubmitting || !trimmedCode ? 0.6 : 1 }}
					>
						{isSubmitting && <ActivityIndicator size="small" color="#3f2e00" />}
						<Text className="font-semibold text-base text-primary-foreground">
							{isSubmitting ? "Verifying" : "Verify and continue"}
						</Text>
					</Pressable>
				</View>

				<View className="flex-row items-center justify-center">
					<Text className="text-muted-foreground text-sm">Didn't get it? </Text>
					<Pressable
						disabled={resendMutation.isPending || cooldown > 0}
						onPress={() => resendMutation.mutate()}
					>
						<Text
							className={
								resendMutation.isPending || cooldown > 0
									? "font-semibold text-muted-foreground text-sm"
									: "font-semibold text-accent text-sm"
							}
						>
							{cooldown > 0
								? `Resend in ${cooldown}s`
								: resendMutation.isPending
									? "Sending..."
									: "Resend code"}
						</Text>
					</Pressable>
				</View>
			</View>
		</Screen>
	);
}
