import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

interface ConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: ReactNode;
	confirmLabel: string;
	pendingLabel?: string;
	onConfirm: () => void;
	isPending?: boolean;
	variant?: "default" | "destructive";
}

/**
 * Generic destructive-action confirmation. For the "remove all watches" flow with
 * its bespoke copy, see ConfirmRemoveDialog instead.
 */
export default function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	pendingLabel,
	onConfirm,
	isPending = false,
	variant = "destructive",
}: ConfirmDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<AlertTriangle className="size-5 text-amber-500" />
						{title}
					</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="btn btn-secondary"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						disabled={isPending}
						className={
							variant === "destructive"
								? "btn bg-red-600 text-white hover:bg-red-700"
								: "btn btn-primary"
						}
					>
						{isPending ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								{pendingLabel ?? "Working..."}
							</>
						) : (
							confirmLabel
						)}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
