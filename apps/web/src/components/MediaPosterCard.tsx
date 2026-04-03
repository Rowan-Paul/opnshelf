import type { UserDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Bookmark, Check, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { AddToListModal } from "@/components/AddToListModal";
import { M3Button } from "@/components/ui/m3-button";
import { cn, getTmdbPosterUrl } from "@/lib/utils";

interface MediaPosterCardProps {
	posterPath?: string | null;
	title: string;
	subtitle?: string;
	metaText?: string; // Role information (e.g., "as Character • Director")
	badge?: string;

	to: string;
	params: Record<string, string>;

	isOnShelf?: boolean;
	onToggleShelf?: () => void;
	isShelfPending?: boolean;

	listMedia?: { type: "movie" | "show"; id: string; title: string };

	onRemove?: () => void;
	isRemoving?: boolean;
	removeIcon?: "trash" | "x";

	readOnly?: boolean;
	user?: UserDto | null;
	className?: string;
}

const HOVER_REVEAL =
	"[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 transition-opacity";

export function MediaPosterCard({
	posterPath,
	title,
	subtitle,
	metaText,
	badge,
	to,
	params,
	isOnShelf,
	onToggleShelf,
	isShelfPending = false,
	listMedia,
	onRemove,
	isRemoving = false,
	removeIcon = "trash",
	readOnly = false,
	user,
	className,
}: MediaPosterCardProps) {
	const [listModalOpen, setListModalOpen] = useState(false);
	const posterUrl = getTmdbPosterUrl(posterPath);
	const showActions = !readOnly && !!user;
	const RemoveIcon = removeIcon === "x" ? X : Trash2;

	return (
		<div className={cn("group", className)}>
			<Link
				to={to as never}
				params={params as never}
				className="block relative aspect-2/3 rounded-lg overflow-hidden mb-2"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container-high)",
				}}
			>
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={title}
						className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
					/>
				) : (
					<div
						className="w-full h-full flex items-center justify-center md-body-medium"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						No poster
					</div>
				)}

				{badge && (
					<div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-3">
						<div className="text-white text-sm font-medium">{badge}</div>
					</div>
				)}

				{showActions && (
					<div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
						{onToggleShelf && (
							<M3Button
								type="button"
								size="icon"
								variant="filled"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onToggleShelf();
								}}
								isLoading={isShelfPending}
								className={cn(
									"shadow-lg ring-1 ring-black/10 transition-transform duration-200 ease-out",
									isOnShelf
										? "bg-(--md-sys-color-tertiary) hover:bg-(--md-sys-color-error)"
										: HOVER_REVEAL,
									// When watched, start at list button position, slide left on hover
									isOnShelf && "translate-x-10 group-hover:translate-x-0",
								)}
							>
								{isOnShelf ? (
									<Check className="size-5" />
								) : (
									<Plus className="size-5" />
								)}
							</M3Button>
						)}

						{listMedia && (
							<M3Button
								type="button"
								size="icon"
								variant="filled-tonal"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									setListModalOpen(true);
								}}
								className={cn("shadow-lg ring-1 ring-black/10", HOVER_REVEAL)}
							>
								<Bookmark className="size-5" />
							</M3Button>
						)}

						{onRemove && (
							<M3Button
								type="button"
								size="icon"
								variant="destructive"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onRemove();
								}}
								isLoading={isRemoving}
								className={cn("shadow-lg ring-1 ring-black/10", HOVER_REVEAL)}
							>
								<RemoveIcon className="size-5" />
							</M3Button>
						)}
					</div>
				)}
			</Link>

			<Link to={to as never} params={params as never} className="block">
				<h3 className="font-semibold text-sm line-clamp-2 mb-1 transition-colors hover:text-(--md-sys-color-primary)">
					{title}
				</h3>
				{subtitle && (
					<p
						className="text-sm"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{subtitle}
					</p>
				)}
				{metaText && (
					<p
						className="text-sm line-clamp-2"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{metaText}
					</p>
				)}
			</Link>

			{listMedia && user && (
				<AddToListModal
					open={listModalOpen}
					onOpenChange={setListModalOpen}
					mediaType={listMedia.type}
					mediaId={listMedia.id}
					mediaTitle={listMedia.title}
					user={user}
				/>
			)}
		</div>
	);
}
