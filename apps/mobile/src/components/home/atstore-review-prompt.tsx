import {
	atStoreReviewsControllerDismissMutation,
	atStoreReviewsControllerGetPromptOptions,
	authControllerPermissionsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { type Href, router } from "expo-router";
import { Store } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { beginHandoff } from "@/lib/auth-handoff";
import { posthog } from "@/lib/posthog";

const PLATFORM = { platform: "mobile" } as const;

export function AtStoreReviewPrompt() {
	const queryClient = useQueryClient();
	const toast = useToast();
	const { runAuthorizationUrl } = useAuth();
	const viewed = useRef(false);
	const promptOptions = atStoreReviewsControllerGetPromptOptions();
	const { data: prompt } = useQuery({
		...promptOptions,
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	useEffect(() => {
		if (prompt?.eligible && !viewed.current) {
			viewed.current = true;
			posthog?.capture("atstore_review_prompt_viewed", PLATFORM);
		}
	}, [prompt?.eligible]);

	const dismissMutation = useMutation({
		mutationKey: ["atstore-review", "dismiss"],
		...atStoreReviewsControllerDismissMutation(),
		onSuccess: () => {
			queryClient.setQueryData(promptOptions.queryKey, {
				eligible: false,
				permissionGranted: prompt?.permissionGranted ?? false,
			});
			posthog?.capture("atstore_review_prompt_dismissed", PLATFORM);
		},
		onError: () => toast.error("Could not dismiss the review request"),
	});

	const permissionMutation = useMutation({
		mutationKey: ["auth", "permissions", "atstore-review"],
		...authControllerPermissionsMutation(),
		onSuccess: async ({ authorizationUrl }) => {
			try {
				const granted = await runAuthorizationUrl(authorizationUrl);
				if (granted) router.push("/atstore-review" as Href);
			} catch {
				toast.error("Review permission was not granted");
			}
		},
		onError: () => toast.error("Could not request review permission"),
	});

	const leaveReview = async () => {
		if (process.env.EXPO_OS === "ios") {
			void Haptics.selectionAsync();
		}
		posthog?.capture("atstore_review_prompt_clicked", PLATFORM);
		if (prompt?.permissionGranted) {
			router.push("/atstore-review" as Href);
			return;
		}
		// Handoff code (ADR 0026): the challenge rides in the OAuth state so the
		// callback hands back a single-use code instead of the session id.
		const codeChallenge = (await beginHandoff()) ?? undefined;
		permissionMutation.mutate({
			body: {
				integration: "atstore",
				action: "connect",
				platform: "mobile",
				codeChallenge,
			},
		});
	};

	if (!prompt?.eligible) return null;

	return (
		<View className="gap-4 rounded-xl border border-border bg-card p-4">
			<View className="flex-row items-start gap-3">
				<View className="size-10 items-center justify-center rounded-full bg-primary/15">
					<Store color="#f3bc00" size={19} />
				</View>
				<View className="min-w-0 flex-1 gap-1">
					<Text className="font-display font-semibold text-foreground text-lg">
						Enjoying Opnshelf?
					</Text>
					<Text className="text-muted-foreground text-sm leading-5">
						Share your experience on AT Store. It helps others discover
						Opnshelf.
					</Text>
				</View>
			</View>
			<View className="flex-row justify-end gap-2">
				<Pressable
					accessibilityRole="button"
					disabled={dismissMutation.isPending}
					onPress={() => dismissMutation.mutate({})}
					className="rounded-lg px-3.5 py-2.5"
					style={{ opacity: dismissMutation.isPending ? 0.5 : 1 }}
				>
					<Text className="font-semibold text-muted-foreground text-sm">
						No thanks
					</Text>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					disabled={permissionMutation.isPending}
					onPress={leaveReview}
					className="rounded-lg bg-primary px-4 py-2.5"
					style={{ opacity: permissionMutation.isPending ? 0.5 : 1 }}
				>
					<Text className="font-semibold text-[#3f2e00] text-sm">
						Leave a review
					</Text>
				</Pressable>
			</View>
		</View>
	);
}
