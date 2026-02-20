import { Check, Eye, History, Loader2, Trash2 } from "lucide-react";
import type { ColorTheme } from "./types";

type TrackedStatusCardProps = {
	isWatched: boolean;
	watchedDate?: string | null;
	totalWatches?: number;
	onViewHistory?: () => void;
	onRemove?: () => void;
	isRemoving?: boolean;
	colors: ColorTheme;
};

export function TrackedStatusCard({
	isWatched,
	watchedDate,
	totalWatches = 0,
	onViewHistory,
	onRemove,
	isRemoving = false,
	colors,
}: TrackedStatusCardProps) {
	if (!isWatched) {
		return null;
	}

	return (
		<div
			className="p-4 rounded-xl"
			style={{
				backgroundColor: "var(--md-sys-color-surface-container-highest)",
			}}
		>
			<div
				className="flex items-center gap-2 mb-2"
				style={{ color: colors.primary }}
			>
				<Check className="w-5 h-5" />
				<span className="m3-title-medium">On Your Shelf</span>
			</div>

			{watchedDate && (
				<p
					className="m3-body-medium"
					style={{ color: "var(--md-sys-color-on-surface-variant)" }}
				>
					Watched on {watchedDate}
				</p>
			)}

			{totalWatches > 1 && (
				<>
					<div
						className="mt-2 flex items-center gap-2 m3-body-small"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						<History className="w-3 h-3" />
						<span>{totalWatches} total watches</span>
					</div>
					{onViewHistory && (
						<button
							type="button"
							onClick={onViewHistory}
							className="mt-2 flex items-center gap-2 m3-body-medium transition-colors py-2 px-3 -ml-3 rounded-lg"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							onMouseEnter={(e) => {
								e.currentTarget.style.color = "var(--md-sys-color-on-surface)";
								e.currentTarget.style.backgroundColor =
									"var(--md-sys-color-surface-container)";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.color =
									"var(--md-sys-color-on-surface-variant)";
								e.currentTarget.style.backgroundColor = "transparent";
							}}
						>
							<Eye className="w-4 h-4" />
							View all watches
						</button>
					)}
				</>
			)}

			{totalWatches <= 1 && onRemove && (
				<button
					type="button"
					onClick={onRemove}
					disabled={isRemoving}
					className="mt-2 flex items-center gap-2 m3-body-medium transition-colors py-2 px-3 -ml-3 rounded-lg disabled:opacity-50"
					style={{ color: "var(--md-sys-color-error)" }}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor =
							"var(--md-sys-color-error-container)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = "transparent";
					}}
				>
					{isRemoving ? (
						<>
							<Loader2 className="w-4 h-4 animate-spin" />
							Loading
						</>
					) : (
						<>
							<Trash2 className="w-4 h-4" />
							Remove from shelf
						</>
					)}
				</button>
			)}
		</div>
	);
}
