import { History, Loader2, Trash2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { M3Button } from "@/components/ui/m3-button";
import { formatDateWithTimezone } from "@/lib/utils";

type WatchHistoryItem = {
	id: string;
	watchedDate: string;
};

type WatchHistoryDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	description: string;
	watchHistory: WatchHistoryItem[];
	userTimezone: string;
	is24Hour: boolean;
	onDelete: (id: string) => void;
	isDeleting: boolean;
	onClose: () => void;
	emptyText?: string;
};

export function WatchHistoryDialog({
	open,
	onOpenChange,
	description,
	watchHistory,
	userTimezone,
	is24Hour,
	onDelete,
	isDeleting,
	onClose,
	emptyText = "No watch history found",
}: WatchHistoryDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-w-md"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container-highest)",
					borderColor: "var(--md-sys-color-outline)",
					color: "var(--md-sys-color-on-surface)",
				}}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<History className="w-5 h-5" />
						Watch History
					</DialogTitle>
					<DialogDescription
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{description}
					</DialogDescription>
				</DialogHeader>
				<div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
					{watchHistory.length > 0 ? (
						watchHistory.map((watch) => (
							<div
								key={watch.id}
								className="flex items-center gap-3 p-3 rounded-lg"
								style={{
									backgroundColor: "var(--md-sys-color-surface-container)",
								}}
							>
								<div className="flex-1">
									<p
										className="m3-body-medium"
										style={{ color: "var(--md-sys-color-on-surface)" }}
									>
										{formatDateWithTimezone(watch.watchedDate, {
											timezone: userTimezone,
											is24Hour,
										})}
									</p>
								</div>
								<button
									type="button"
									onClick={() => onDelete(watch.id)}
									disabled={isDeleting}
									className="shrink-0 p-2 rounded-lg transition-colors disabled:opacity-50"
									style={{
										color: "var(--md-sys-color-on-surface-variant)",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.color = "var(--md-sys-color-error)";
										e.currentTarget.style.backgroundColor =
											"var(--md-sys-color-error-container)";
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.color =
											"var(--md-sys-color-on-surface-variant)";
										e.currentTarget.style.backgroundColor = "transparent";
									}}
								>
									{isDeleting ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										<Trash2 className="w-4 h-4" />
									)}
								</button>
							</div>
						))
					) : (
						<div
							className="text-center py-8 m3-body-large"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							{emptyText}
						</div>
					)}
				</div>
				<div className="mt-4 flex justify-end">
					<M3Button variant="outlined" onClick={onClose}>
						Close
					</M3Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
