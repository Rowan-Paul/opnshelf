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
import {
	PromptCard,
	PromptSlotItem,
	usePromptCooldown,
} from "@/components/home/prompt-slot";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { beginHandoff } from "@/lib/auth-handoff";
import { posthog } from "@/lib/posthog";

const PLATFORM = { platform: "mobile" } as const;

export function AtStoreReviewPrompt() {
	const queryClient = useQueryClient();
	const startCooldown = usePromptCooldown();
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
			startCooldown();
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
		<PromptSlotItem id="atstore-review">
			<PromptCard
				icon={Store}
				title="Enjoying Opnshelf?"
				actions={
					<>
						<Button
							label="No thanks"
							variant="ghost"
							size="sm"
							disabled={dismissMutation.isPending}
							onPress={() => dismissMutation.mutate({})}
						/>
						<Button
							label="Leave a review"
							size="sm"
							loading={permissionMutation.isPending}
							onPress={leaveReview}
						/>
					</>
				}
			>
				Share your experience on AT Store. It helps others discover Opnshelf.
			</PromptCard>
		</PromptSlotItem>
	);
}
