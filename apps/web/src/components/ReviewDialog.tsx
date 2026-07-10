import { usersControllerGetMySettingsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useAuth } from "#/lib/auth-context";
import { useCreateReview, useUpdateReview } from "#/lib/hooks/useReviews";

// The WYSIWYG editor (Milkdown/ProseMirror) is DOM-only and heavy, so it is
// lazy-loaded and rendered client-side only (see the `mounted` gate below).
const MarkdownEditor = lazy(() => import("./MarkdownEditor"));

export interface EditableReview {
	id: string;
	title: string;
	markdown: string;
	/** Current mirror state; defaults to on when unset (e.g. a fresh review). */
	mirrorToBlog?: boolean;
}

interface ReviewDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	/** When set, the dialog edits this review; otherwise it creates a new one. */
	review?: EditableReview;
	onSuccess?: () => void;
	/**
	 * Element id to scroll into view after a successful save, so the user lands
	 * on their freshly published review. Defaults to the community reviews
	 * section present on every media page; no-ops if no such element exists.
	 */
	scrollTargetId?: string;
}

export function ReviewDialog({
	open,
	onOpenChange,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
	review,
	onSuccess,
	scrollTargetId = "community-reviews",
}: ReviewDialogProps) {
	const { user } = useAuth();
	const userDid = user?.did ?? "";

	const createMutation = useCreateReview({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});
	const updateMutation = useUpdateReview({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const [title, setTitle] = useState("");
	const [markdown, setMarkdown] = useState("");
	const [mirrorToBlog, setMirrorToBlog] = useState(true);
	const [postToBluesky, setPostToBluesky] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Client-only gate: the editor cannot render during SSR.
	const [mounted, setMounted] = useState(false);

	// The mirror toggle only appears when the author has a blog configured.
	const { data: settings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!userDid,
	});
	const blogName =
		settings?.reviewsPublicationName ?? settings?.reviewsPublicationUri ?? null;
	const hasBlog = !!settings?.reviewsPublicationUri;

	const wasPending = useRef(false);
	const isEditing = !!review;
	const isPending = createMutation.isPending || updateMutation.isPending;

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (open) {
			setTitle(review?.title ?? "");
			setMarkdown(review?.markdown ?? "");
			setMirrorToBlog(review?.mirrorToBlog ?? true);
			setPostToBluesky(false);
			setError(null);
		}
	}, [open, review?.title, review?.markdown, review?.mirrorToBlog]);

	useEffect(() => {
		const succeeded = createMutation.isSuccess || updateMutation.isSuccess;
		if (wasPending.current && !isPending && succeeded) {
			onOpenChange(false);
			onSuccess?.();
			if (scrollTargetId) {
				// Defer so the dialog can start closing and the list can render the
				// new review before we scroll to it.
				requestAnimationFrame(() => {
					document
						.getElementById(scrollTargetId)
						?.scrollIntoView({ behavior: "smooth", block: "start" });
				});
			}
			createMutation.reset();
			updateMutation.reset();
		}
		wasPending.current = isPending;
	}, [
		isPending,
		createMutation,
		updateMutation,
		onOpenChange,
		onSuccess,
		scrollTargetId,
	]);

	const resolvedMediaType =
		episodeNumber != null
			? "episode"
			: seasonNumber != null
				? "season"
				: mediaType;

	const trimmedTitle = title.trim();
	const trimmedBody = markdown.trim();
	// The WYSIWYG editor has no hard maxLength, so enforce the cap (counted on
	// the serialized markdown — what actually gets stored) here on save.
	const overLimit = markdown.length > 20000;

	const handleSave = () => {
		if (!trimmedTitle) {
			setError("Give your review a title before publishing.");
			return;
		}
		if (!trimmedBody) {
			setError("Write your review before publishing.");
			return;
		}
		if (overLimit) {
			setError("Your review is over the 20,000 character limit.");
			return;
		}
		setError(null);

		if (isEditing && review) {
			updateMutation.mutate({
				path: { reviewId: review.id },
				body: { title: trimmedTitle, markdown: trimmedBody, mirrorToBlog },
			});
			return;
		}

		createMutation.mutate({
			body: {
				mediaType: resolvedMediaType,
				mediaId,
				seasonNumber,
				episodeNumber,
				title: trimmedTitle,
				markdown: trimmedBody,
				mirrorToBlog,
				postToBluesky,
			},
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Pencil className="size-4 text-(--accent)" />
						{isEditing ? "Edit Review" : "Write a Review"}
					</DialogTitle>
					<DialogDescription className="sr-only">
						Write a long-form review for this title. A title is required.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-1">
					<label
						htmlFor="review-title"
						className="text-(--foreground-muted) text-sm"
					>
						Title <span className="text-red-500">*</span>
					</label>
					<input
						id="review-title"
						value={title}
						onChange={(e) => {
							setTitle(e.target.value);
							setError(null);
						}}
						placeholder="Give your review a title"
						className="input text-sm"
						maxLength={300}
					/>
				</div>

				<span className="text-(--foreground-muted) text-sm">Review</span>

				{mounted ? (
					<Suspense
						fallback={
							<div className="input flex min-h-[238px] items-center justify-center">
								<Loader2 className="size-4 animate-spin text-(--foreground-muted)" />
							</div>
						}
					>
						<MarkdownEditor
							key={review?.id ?? "new"}
							value={review?.markdown ?? ""}
							onChange={(md) => {
								setMarkdown(md);
								setError(null);
							}}
						/>
					</Suspense>
				) : (
					<div className="input min-h-[238px]" />
				)}

				{error && (
					<p className="text-red-500 text-sm" role="alert">
						{error}
					</p>
				)}

				{hasBlog && (
					<label className="flex cursor-pointer items-start gap-2 text-sm">
						<input
							type="checkbox"
							checked={mirrorToBlog}
							onChange={(e) => setMirrorToBlog(e.target.checked)}
							className="mt-0.5 size-4 accent-(--accent)"
						/>
						<span>
							Also publish to my blog
							{blogName ? (
								<span className="text-(--foreground-muted)"> ({blogName})</span>
							) : null}
						</span>
					</label>
				)}

				{!isEditing && (
					<label className="flex cursor-pointer items-start gap-2 text-sm">
						<input
							type="checkbox"
							checked={postToBluesky}
							onChange={(event) => setPostToBluesky(event.target.checked)}
							className="mt-0.5 size-4 accent-(--accent)"
						/>
						<span>Also post on Bluesky</span>
					</label>
				)}

				<div className="flex items-center justify-between">
					<span
						className={`text-xs ${overLimit ? "text-red-500" : "text-(--foreground-subtle)"}`}
					>
						{markdown.length}/20000
					</span>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => onOpenChange(false)}
							className="btn btn-secondary btn-sm gap-1"
						>
							<X className="size-3.5" />
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSave}
							disabled={isPending}
							className="btn btn-primary btn-sm gap-1"
						>
							{isPending ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<Save className="size-3.5" />
							)}
							{isEditing ? "Save" : "Publish"}
						</button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
