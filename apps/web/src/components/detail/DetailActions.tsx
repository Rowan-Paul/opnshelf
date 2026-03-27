import { usePostHog } from "@posthog/react";
import { Calendar, Check, ListPlus, RotateCcw, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddToShelfButton } from "@/components/AddToShelfButton";
import { M3Button } from "@/components/ui/m3-button";
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
	mediaId,
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
	const posthog = usePostHog();

	const handleShare = async () => {
		const url = window.location.href;
		posthog.capture("content_shared", {
			media_type: mediaType,
			media_id: mediaId,
			share_method:
				typeof navigator.share === "function" ? "native" : "clipboard",
			url,
		});
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

	const handleShowListModal = () => {
		posthog.capture("add_to_list_opened", {
			media_type: mediaType,
			media_id: mediaId,
			already_in_lists: listsCount,
		});
		onShowListModal?.();
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
						boxShadow: `0 15px 35px -10px color-mix(in srgb, ${colors.primary} 38%, transparent)`,
						color: "var(--md-sys-color-on-primary)",
					}}
					onClick={onLogin}
				>
					Sign in to Track
				</button>
				<M3Button variant="outlined" onClick={handleShare} className="w-full">
					<Share2 className="w-4 h-4" />
					Share
				</M3Button>
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
							label="Watch Again"
							icon={<RotateCcw className="w-4 h-4" />}
							colors={colors}
							size="compact"
							className="flex-1"
						/>
						<M3Button
							variant="outlined"
							size="icon"
							onClick={onShowDatePicker}
							title={`Watch ${mediaType}`}
							className="h-auto self-stretch"
						>
							<Calendar className="w-5 h-5" />
						</M3Button>
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
					<M3Button
						variant="outlined"
						size="icon"
						onClick={onShowDatePicker}
						title={`Watch ${mediaType}`}
						className="h-auto self-stretch"
					>
						<Calendar className="w-5 h-5" />
					</M3Button>
				</div>
			)}

			{onShowListModal && (
				<M3Button
					variant={isInAnyList ? "filled-tonal" : "outlined"}
					onClick={handleShowListModal}
					className="w-full"
				>
					{isInAnyList ? (
						<Check className="w-4 h-4" />
					) : (
						<ListPlus className="w-4 h-4" />
					)}
					{isInAnyList
						? `In ${listsCount} list${listsCount > 1 ? "s" : ""}`
						: "Add to List"}
				</M3Button>
			)}

			<M3Button variant="outlined" onClick={handleShare} className="w-full">
				<Share2 className="w-4 h-4" />
				{copied ? "Copied!" : "Share"}
			</M3Button>
		</div>
	);
}
