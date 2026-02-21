import { Calendar, Check, ListPlus, RotateCcw, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddToShelfButton } from "@/components/AddToShelfButton";
import { ActionButton } from "@/components/ui/action-button";
import { TrackedStatusCard } from "./TrackedStatusCard";
import type { ColorTheme } from "./types";

type DetailActionsProps = {
	mediaType: "movie" | "show" | "season" | "episode";
	mediaId: string;
	seasonNumber?: string;
	episodeNumber?: string;
	colors: ColorTheme;
	isWatched: boolean;
	watchedDate?: string | null;
	totalWatches?: number;
	onMarkWatched: () => void;
	onUnmarkWatched?: () => void;
	onShowDatePicker: () => void;
	isMarkingPending?: boolean;
	isUnmarkingPending?: boolean;
	listsCount?: number;
	onShowListModal?: () => void;
	onViewHistory?: () => void;
	isLoggedIn?: boolean;
	onLogin?: () => void;
};

export function DetailActions({
	mediaType,
	colors,
	isWatched,
	watchedDate,
	totalWatches = 0,
	onMarkWatched,
	onUnmarkWatched,
	onShowDatePicker,
	isMarkingPending = false,
	isUnmarkingPending = false,
	listsCount = 0,
	onShowListModal,
	onViewHistory,
	isLoggedIn = true,
	onLogin,
}: DetailActionsProps) {
	const [copied, setCopied] = useState(false);

	const handleShare = async () => {
		const url = window.location.href;
		if (navigator.share) {
			try {
				await navigator.share({ url });
			} catch {
				// User cancelled share
			}
		} else {
			try {
				await navigator.clipboard.writeText(url);
				setCopied(true);
				toast.success("Link copied to clipboard");
				setTimeout(() => setCopied(false), 2000);
			} catch {
				toast.error("Failed to copy link");
			}
		}
	};

	const isInAnyList = listsCount > 0;

	if (!isLoggedIn && onLogin) {
		return (
			<div className="space-y-3">
				<button
					type="button"
					className="w-full py-4 px-6 rounded-xl m3-label-large text-center transition-all duration-200 hover:scale-[1.02]"
					style={{
						background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
						boxShadow: `0 15px 35px -10px ${colors.primary}60`,
						color: "var(--md-sys-color-on-primary)",
					}}
					onClick={onLogin}
				>
					Sign in to Track
				</button>
				<ActionButton
					icon={<Share2 className="w-4 h-4" />}
					label="Share"
					onClick={handleShare}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{isWatched ? (
				<>
					<TrackedStatusCard
						isWatched={isWatched}
						watchedDate={watchedDate}
						totalWatches={totalWatches}
						onViewHistory={onViewHistory}
						onRemove={onUnmarkWatched}
						isRemoving={isUnmarkingPending}
						colors={colors}
					/>
					<div className="flex gap-2">
						<AddToShelfButton
							onClick={onMarkWatched}
							isPending={isMarkingPending}
							label="Select Watch Date"
							icon={<RotateCcw className="w-4 h-4" />}
							colors={colors}
							size="compact"
							className="flex-1"
						/>
						<button
							type="button"
							onClick={onShowDatePicker}
							title={`Watch ${mediaType}`}
							className="p-3 rounded-xl border transition-all duration-200 flex items-center justify-center group"
							style={{
								backgroundColor: "transparent",
								borderColor: "var(--md-sys-color-outline)",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor =
									"var(--md-sys-color-surface-container)";
								e.currentTarget.style.borderColor =
									"var(--md-sys-color-primary)";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = "transparent";
								e.currentTarget.style.borderColor =
									"var(--md-sys-color-outline)";
							}}
						>
							<Calendar className="w-5 h-5 text-(--md-sys-color-on-surface-variant) group-hover:text-(--md-sys-color-primary) transition-colors" />
						</button>
					</div>
				</>
			) : (
				<div className="flex gap-2">
					<AddToShelfButton
						onClick={onMarkWatched}
						isPending={isMarkingPending}
						label="Add to Shelf"
						icon={<Calendar className="w-5 h-5" />}
						colors={colors}
						className="flex-1"
					/>
					<button
						type="button"
						onClick={onShowDatePicker}
						title={`Watch ${mediaType}`}
						className="p-3 rounded-xl border transition-all duration-200 flex items-center justify-center group"
						style={{
							backgroundColor: "transparent",
							borderColor: "var(--md-sys-color-outline)",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor =
								"var(--md-sys-color-surface-container)";
							e.currentTarget.style.borderColor = "var(--md-sys-color-primary)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = "transparent";
							e.currentTarget.style.borderColor = "var(--md-sys-color-outline)";
						}}
					>
						<Calendar className="w-5 h-5 text-(--md-sys-color-on-surface-variant) group-hover:text-(--md-sys-color-primary) transition-colors" />
					</button>
				</div>
			)}

			{onShowListModal && (
				<ActionButton
					icon={
						isInAnyList ? (
							<Check className="w-4 h-4" />
						) : (
							<ListPlus className="w-4 h-4" />
						)
					}
					label={
						isInAnyList
							? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
							: "Add to List"
					}
					onClick={onShowListModal}
					isActive={isInAnyList}
					activeColor={colors.primary}
				/>
			)}

			<ActionButton
				icon={<Share2 className="w-4 h-4" />}
				label={copied ? "Copied!" : "Share"}
				onClick={handleShare}
			/>
		</div>
	);
}
