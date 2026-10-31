import {
	atStoreReviewsControllerDismissMutation,
	atStoreReviewsControllerPublishMutation,
	authControllerPermissionsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Store } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PromptCard } from "#/components/PromptCard";
import { PermissionRequestDialog } from "#/components/settings/PermissionRequestDialog";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { posthog } from "#/integrations/posthog/provider";
import { atStoreHomePromptQuery, useEligibleAtMount } from "#/lib/home-prompts";
import { startPromptCooldown } from "#/lib/prompt-state";

const PLATFORM = { platform: "web" } as const;

export function AtStoreReviewPrompt() {
	const queryClient = useQueryClient();
	const viewed = useRef(false);
	const redirectHandled = useRef(false);
	const [composerOpen, setComposerOpen] = useState(false);
	const [permissionRequestOpen, setPermissionRequestOpen] = useState(false);
	const [rating, setRating] = useState<number | null>(null);
	const [text, setText] = useState("");

	const promptOptions = atStoreHomePromptQuery();
	const eligibleAtMount = useEligibleAtMount(
		promptOptions.queryKey,
		(data: { eligible?: boolean } | undefined) => Boolean(data?.eligible),
	);
	const { data: prompt } = useQuery(promptOptions);
	const visible = eligibleAtMount && Boolean(prompt?.eligible);

	useEffect(() => {
		if (visible && !viewed.current) {
			viewed.current = true;
			posthog.capture("atstore_review_prompt_viewed", PLATFORM);
		}
	}, [visible]);

	useEffect(() => {
		if (redirectHandled.current || typeof window === "undefined") return;
		const url = new URL(window.location.href);
		const reviewState = url.searchParams.get("review");
		if (!reviewState) return;
		redirectHandled.current = true;
		url.searchParams.delete("review");
		window.history.replaceState(
			{},
			"",
			`${url.pathname}${url.search}${url.hash}`,
		);
		if (reviewState === "compose") {
			setComposerOpen(true);
		} else if (reviewState === "permission-declined") {
			toast.message("Review permission was not granted");
		} else if (reviewState === "permission-failed") {
			toast.error("Could not request review permission");
		}
	}, []);

	const dismissMutation = useMutation({
		mutationKey: ["atstore-review", "dismiss"],
		...atStoreReviewsControllerDismissMutation(),
		onSuccess: () => {
			queryClient.setQueryData(promptOptions.queryKey, {
				eligible: false,
				permissionGranted: prompt?.permissionGranted ?? false,
			});
			startPromptCooldown();
			posthog.capture("atstore_review_prompt_dismissed", PLATFORM);
		},
		onError: () => toast.error("Could not dismiss the review request"),
	});

	const permissionMutation = useMutation({
		mutationKey: ["auth", "permissions", "atstore-review"],
		...authControllerPermissionsMutation(),
		onSuccess: ({ authorizationUrl }) => {
			window.location.assign(authorizationUrl);
		},
		onError: () => toast.error("Could not request review permission"),
	});

	const publishMutation = useMutation({
		mutationKey: ["atstore-review", "publish"],
		...atStoreReviewsControllerPublishMutation(),
		onSuccess: () => {
			queryClient.setQueryData(promptOptions.queryKey, {
				eligible: false,
				permissionGranted: true,
			});
			posthog.capture("atstore_review_published", PLATFORM);
			setComposerOpen(false);
			setRating(null);
			setText("");
			toast.success("Review published");
		},
		onError: () => toast.error("Could not publish your review. Try again."),
	});

	const openComposer = () => {
		posthog.capture("atstore_review_prompt_clicked", PLATFORM);
		if (prompt?.permissionGranted) {
			setComposerOpen(true);
			return;
		}
		setPermissionRequestOpen(true);
	};

	useEffect(() => {
		if (composerOpen) {
			posthog.capture("atstore_review_composer_opened", PLATFORM);
		}
	}, [composerOpen]);

	const closeComposer = () => {
		if (
			(rating !== null || text.length > 0) &&
			!window.confirm("Discard this review?")
		) {
			return;
		}
		setComposerOpen(false);
		setRating(null);
		setText("");
	};

	if (!visible) return null;

	return (
		<>
			<PromptCard
				icon={Store}
				title="Enjoying Opnshelf?"
				actions={
					<>
						<Button
							type="button"
							variant="ghost"
							disabled={dismissMutation.isPending}
							onClick={() => dismissMutation.mutate({})}
						>
							No thanks
						</Button>
						<Button
							type="button"
							disabled={permissionMutation.isPending}
							onClick={openComposer}
						>
							Leave a review
						</Button>
					</>
				}
			>
				Share your experience on AT Store. It helps others discover Opnshelf.
			</PromptCard>

			<PermissionRequestDialog
				integration="atstore"
				open={permissionRequestOpen}
				pending={permissionMutation.isPending}
				onCancel={() => setPermissionRequestOpen(false)}
				onContinue={() =>
					permissionMutation.mutate({
						body: { integration: "atstore", action: "connect" },
					})
				}
			/>

			<Dialog
				open={composerOpen}
				onOpenChange={(open) => !open && closeComposer()}
			>
				<DialogContent className="sm:max-w-xl" showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>Review Opnshelf</DialogTitle>
						<DialogDescription>
							Your review will appear on Opnshelf’s page at atstore.fyi.
						</DialogDescription>
					</DialogHeader>

					<fieldset className="space-y-3">
						<legend className="font-medium text-sm">Your rating</legend>
						<div className="flex gap-2">
							{[1, 2, 3, 4, 5].map((value) => (
								<button
									key={value}
									type="button"
									aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
									aria-pressed={rating === value}
									onClick={() => setRating(value)}
									className="rounded-lg p-1.5 text-(--foreground-muted) outline-none transition-transform hover:scale-110 hover:text-(--accent) focus-visible:ring-(--accent) focus-visible:ring-2"
								>
									<Star
										className={`size-8 ${rating !== null && value <= rating ? "fill-(--accent) text-(--accent)" : ""}`}
									/>
								</button>
							))}
						</div>
					</fieldset>

					<label className="grid gap-2 font-medium text-sm">
						Review{" "}
						<span className="font-normal text-(--foreground-muted)">
							(optional)
						</span>
						<textarea
							value={text}
							onChange={(event) => setText(event.target.value)}
							maxLength={8000}
							rows={6}
							placeholder="What has your experience been like?"
							className="min-h-32 resize-y rounded-lg border border-(--border) bg-background px-3 py-2 font-normal text-base outline-none focus:border-(--accent) focus:ring-(--accent)/20 focus:ring-2"
						/>
						<span className="text-right font-normal text-(--foreground-muted) text-xs tabular-nums">
							{text.length.toLocaleString()} / 8,000
						</span>
					</label>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={closeComposer}>
							Cancel
						</Button>
						<Button
							type="button"
							disabled={rating === null || publishMutation.isPending}
							onClick={() =>
								rating !== null &&
								publishMutation.mutate({
									body: { rating, text: text || undefined },
								})
							}
						>
							{publishMutation.isPending ? "Publishing…" : "Publish review"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
