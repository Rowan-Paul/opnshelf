import { Loader2, Plus, X } from "lucide-react";
import type { ComponentProps } from "react";
import { WatchCountBadge } from "#/components/WatchCountBadge";
import { WatchDatePicker } from "#/components/WatchDatePicker";
import { useAuth } from "#/lib/auth-context";
import { formatDateTime } from "#/lib/date-utils";

interface WatchHistoryEntry {
	id: string;
	watchedDate?: string;
}

interface YourActivityProps {
	watchHistory: WatchHistoryEntry[];
	/** `null` creates an undated Watch. */
	onAddToShelf: (watchedAt: string | null) => void;
	onDeleteEntry: (id: string) => void;
	isAddPending?: boolean;
	isDeletePending?: boolean;
}

// Spreads the rest props: Radix's `asChild` clones this and injects its own
// handlers and ref onto it.
function AddToShelfTrigger({
	isPending,
	className,
	...props
}: ComponentProps<"button"> & { isPending: boolean }) {
	return (
		<button
			type="button"
			disabled={isPending}
			className={`btn btn-secondary gap-2 ${className ?? ""}`}
			{...props}
		>
			{isPending ? (
				<>
					<Loader2 className="size-4 animate-spin" />
					Loading
				</>
			) : (
				<>
					<Plus className="size-4" />
					Add to shelf
				</>
			)}
		</button>
	);
}

export function YourActivity({
	watchHistory,
	onAddToShelf,
	onDeleteEntry,
	isAddPending = false,
	isDeletePending = false,
}: YourActivityProps) {
	const { userSettings } = useAuth();
	const userTimezone = userSettings?.timezone;
	const userTimeFormat = userSettings?.timeFormat;

	return (
		<section className="card p-5">
			<div className="mb-4 flex items-center justify-between gap-2">
				<h3 className="font-display font-semibold">Your Activity</h3>
				{/* Same pill the posters use, so the count reads the same whether you
				    got here from a card or from the detail page. */}
				{watchHistory.length > 0 && (
					<WatchCountBadge
						watchCount={watchHistory.length}
						className={`h-6 ${watchHistory.length > 1 ? "" : "w-6"}`}
					/>
				)}
			</div>
			{watchHistory.length > 0 ? (
				<div className="space-y-1">
					{watchHistory.map((entry, index) => (
						<div
							key={entry.id || index}
							className="group flex items-center rounded-lg transition-colors hover:bg-(--background-subtle)"
						>
							<div className="flex flex-1 items-center p-2">
								<span className="font-medium text-sm">
									{entry.watchedDate
										? formatDateTime(
												entry.watchedDate,
												userTimezone,
												userTimeFormat,
											)
										: "No date"}
								</span>
							</div>
							<button
								type="button"
								onClick={() => onDeleteEntry(entry.id)}
								disabled={isDeletePending}
								className="flex h-8 w-8 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-red-500/10 hover:text-red-500"
								aria-label="Remove this watch"
							>
								<X className="size-4" />
							</button>
						</div>
					))}
					<WatchDatePicker
						isPending={isAddPending}
						onConfirm={onAddToShelf}
						trigger={
							<AddToShelfTrigger
								isPending={isAddPending}
								className="mt-3 w-full"
							/>
						}
					/>
				</div>
			) : (
				<div className="space-y-3">
					<p className="text-(--foreground-muted) text-sm">
						You haven&apos;t watched this yet
					</p>
					<WatchDatePicker
						isPending={isAddPending}
						onConfirm={onAddToShelf}
						trigger={
							<AddToShelfTrigger
								isPending={isAddPending}
								className="w-full text-sm"
							/>
						}
					/>
				</div>
			)}
		</section>
	);
}
