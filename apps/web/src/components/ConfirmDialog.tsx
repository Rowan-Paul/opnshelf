import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { M3Button } from "@/components/ui/m3-button";

interface ConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	title: string;
	description: string;
	confirmText?: string;
	cancelText?: string;
	isLoading?: boolean;
	danger?: boolean;
}

export function ConfirmDialog({
	open,
	onOpenChange,
	onConfirm,
	title,
	description,
	confirmText = "Confirm",
	cancelText = "Cancel",
	isLoading = false,
	danger = false,
}: ConfirmDialogProps) {
	const handleConfirm = () => {
		onConfirm();
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-(--md-sys-color-surface-container-high) border-(--md-sys-color-outline) text-(--md-sys-color-on-surface) rounded-xl">
				<DialogHeader>
					<DialogTitle className="text-(--md-sys-color-on-surface)">
						{title}
					</DialogTitle>
					<DialogDescription className="text-(--md-sys-color-on-surface-variant)">
						{description}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<M3Button
						variant="outlined"
						onClick={() => onOpenChange(false)}
						disabled={isLoading}
						className="border-(--md-sys-color-outline) text-(--md-sys-color-on-surface)"
					>
						{cancelText}
					</M3Button>
					<M3Button
						variant={danger ? "filled" : "filled"}
						onClick={handleConfirm}
						disabled={isLoading}
						style={
							danger
								? {
										backgroundColor: "var(--md-sys-color-error)",
										color: "var(--md-sys-color-on-error)",
									}
								: undefined
						}
					>
						{isLoading ? "Loading..." : confirmText}
					</M3Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
