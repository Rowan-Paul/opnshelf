import { AlertTriangle, Loader2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

interface ConfirmRemoveDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	entryCount: number;
	onConfirm: () => void;
	isPending: boolean;
}

export default function ConfirmRemoveDialog({
	open,
	onOpenChange,
	title,
	entryCount,
	onConfirm,
	isPending,
}: ConfirmRemoveDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<AlertTriangle className="size-5 text-amber-500" />
						Remove all plays?
					</DialogTitle>
					<DialogDescription>
						This will remove all <strong>{entryCount}</strong> watch entries for{" "}
						<strong>{title}</strong>. This action cannot be undone.
					</DialogDescription>
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
						onClick={() => {
							onConfirm();
						}}
						disabled={isPending}
						className="btn bg-red-600 text-white hover:bg-red-700"
					>
						{isPending ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Removing...
							</>
						) : (
							"Remove all"
						)}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
