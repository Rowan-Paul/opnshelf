import {
	atStoreReviewsControllerDismissMutation,
	atStoreReviewsControllerGetPromptOptions,
	authControllerPermissions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { type Href, router } from "expo-router";
import { Store } from "lucide-react-native";
import { useRef, useState } from "react";
import {
	PromptCard,
	PromptSlotItem,
	usePromptCooldown,
} from "@/components/home/prompt-slot";
import { usePermissionExplainer } from "@/components/permission-explainer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { AuthFlowError, authErrorMessage } from "@/lib/auth-error";
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

	// Counted when the card is on screen, not when it is merely eligible: the
	// slot may be showing a higher-priority Prompt or cooling down.
	const recordView = () => {
		if (viewed.current) return;
		viewed.current = true;
		posthog?.capture("atstore_review_prompt_viewed", PLATFORM);
	};

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

	const explainer = usePermissionExplainer();
	const [requestingPermission, setRequestingPermission] = useState(false);

	const leaveReview = async () => {
		if (process.env.EXPO_OS === "ios") {
			void Haptics.selectionAsync();
		}
		posthog?.capture("atstore_review_prompt_clicked", PLATFORM);
		if (prompt?.permissionGranted) {
			router.push("/atstore-review" as Href);
			return;
		}
		setRequestingPermission(true);
		try {
			// Handoff code (ADR 0026): the challenge rides in the OAuth state so the
			// callback hands back a single-use code instead of the session id.
			const codeChallenge = (await beginHandoff()) ?? undefined;
			const authorizationUrl = await explainer.request({
				integration: "atstore",
				action: "connect",
				start: async () =>
					(
						await authControllerPermissions({
							body: {
								integration: "atstore",
								action: "connect",
								platform: "mobile",
								codeChallenge,
							},
							throwOnError: true,
						})
					).data.authorizationUrl,
			});
			if (!authorizationUrl) return;
			const granted = await runAuthorizationUrl(authorizationUrl);
			if (granted) router.push("/atstore-review" as Href);
		} catch (error) {
			toast.error(
				error instanceof AuthFlowError
					? authErrorMessage(error.code)
					: "Could not request review permission",
			);
		} finally {
			setRequestingPermission(false);
		}
	};

	if (!prompt?.eligible) return null;

	return (
		<>
			<PromptSlotItem id="atstore-review" onShown={recordView}>
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
								loading={requestingPermission}
								onPress={leaveReview}
							/>
						</>
					}
				>
					Share your experience on AT Store. It helps others discover Opnshelf.
				</PromptCard>
			</PromptSlotItem>
			{explainer.sheet}
		</>
	);
}
