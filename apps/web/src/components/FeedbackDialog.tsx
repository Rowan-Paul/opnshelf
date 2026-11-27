import { useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useDialogOpening } from "#/lib/hooks/useDialogOpening";

interface FeedbackDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: {
		category: "bug" | "feature_request";
		message: string;
	}) => Promise<void>;
	isSubmitting?: boolean;
}

export function FeedbackDialog({
	open,
	onOpenChange,
	onSubmit,
	isSubmitting = false,
}: FeedbackDialogProps) {
	const [category, setCategory] = useState<"bug" | "feature_request">("bug");
	const [message, setMessage] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [wasOpen, setWasOpen] = useState(open);

	// Keep the exit content intact and reset the form before the next opening.
	if (wasOpen !== open) {
		setWasOpen(open);
		if (open) {
			setSubmitted(false);
			setMessage("");
			setCategory("bug");
		}
	}

	const startSend = useDialogOpening(open);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!message.trim()) return;
		const isCurrent = startSend();
		const sent = message.trim();

		try {
			await onSubmit({ category, message: sent });
			toast.success("Feedback sent. Thank you!");
			if (!isCurrent()) return;
			setSubmitted(true);
			setMessage("");
			setCategory("bug");
		} catch {
			toast.error("Failed to send feedback. Please try again.");
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Send Feedback</DialogTitle>
					<DialogDescription>
						Your feedback will become a public GitHub issue. Please leave out
						personal information and secrets.
					</DialogDescription>
				</DialogHeader>

				{submitted ? (
					<div className="flex flex-col items-center gap-3 py-6">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-success dark:bg-green-900/30 dark:text-green-400">
							<svg
								role="img"
								aria-label="Success"
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<title>Success</title>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</div>
						<p className="text-center font-medium">
							Thank you for your feedback!
						</p>
						<p className="text-center text-muted-foreground text-sm">
							We appreciate you taking the time to help us improve.
						</p>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
						<div>
							<label
								htmlFor="feedback-category"
								className="mb-1.5 block font-medium text-sm"
							>
								Category
							</label>
							<select
								id="feedback-category"
								value={category}
								onChange={(e) =>
									setCategory(e.target.value as "bug" | "feature_request")
								}
								className="input w-full"
							>
								<option value="bug">Bug report</option>
								<option value="feature_request">Feature request</option>
							</select>
						</div>

						<div>
							<label
								htmlFor="feedback-message"
								className="mb-1.5 block font-medium text-sm"
							>
								Message
							</label>
							<textarea
								id="feedback-message"
								value={message}
								onChange={(e) => setMessage(e.target.value)}
								placeholder="Describe your issue or idea..."
								className="input min-h-[120px] resize-none"
								maxLength={5000}
								required
							/>
							<p className="mt-1 text-right text-muted-foreground text-xs">
								{message.length}/5000
							</p>
						</div>

						<DialogFooter>
							<button
								type="button"
								onClick={() => onOpenChange(false)}
								className="btn btn-secondary"
								disabled={isSubmitting}
								aria-busy={isSubmitting}
							>
								Cancel
							</button>
							<button
								type="submit"
								className="btn btn-primary"
								disabled={isSubmitting || !message.trim()}
								aria-busy={isSubmitting}
							>
								{isSubmitting ? (
									<>
										<svg
											role="img"
											aria-label="Loading"
											className="size-4 animate-spin"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<title>Loading</title>
											<circle
												className="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="4"
											/>
											<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											/>
										</svg>
										Sending...
									</>
								) : (
									"Send feedback"
								)}
							</button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
