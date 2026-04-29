import { Loader2, Plus, X } from "lucide-react";
import { useAuth } from "#/lib/auth-context";
import { formatDateTime } from "#/lib/date-utils";

interface WatchHistoryEntry {
	id: string;
	watchedDate?: string;
}

interface YourActivityProps {
	watchHistory: WatchHistoryEntry[];
	onAddToShelf: () => void;
	onDeleteEntry: (id: string) => void;
	isAddPending?: boolean;
	isDeletePending?: boolean;
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
			<h3 className="mb-4 font-display font-semibold">Your Activity</h3>
			{watchHistory.length > 0 ? (
				<div className="space-y-1">
					{watchHistory.map((entry, index) => (
						<div
							key={entry.id || index}
							className="group flex items-center rounded-lg transition-colors hover:bg-(--background-subtle)"
						>
							<div className="flex flex-1 items-center p-2">
								<span className="font-medium text-sm">
									{formatDateTime(
										entry.watchedDate || "",
										userTimezone,
										userTimeFormat,
									)}
								</span>
							</div>
							<button
								type="button"
								onClick={() => onDeleteEntry(entry.id)}
								disabled={isDeletePending}
								className="flex h-8 w-8 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-red-500/10 hover:text-red-500"
								aria-label="Remove this play"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					))}
					<button
						type="button"
						onClick={onAddToShelf}
						disabled={isAddPending}
						className="btn btn-secondary mt-3 w-full gap-2"
					>
						{isAddPending ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Loading
							</>
						) : (
							<>
								<Plus className="h-4 w-4" />
								Add to shelf
							</>
						)}
					</button>
				</div>
			) : (
				<div className="space-y-3">
					<p className="text-(--foreground-muted) text-sm">
						You haven&apos;t watched this yet
					</p>
					<button
						type="button"
						onClick={onAddToShelf}
						disabled={isAddPending}
						className="btn btn-secondary w-full gap-2 text-sm"
					>
						{isAddPending ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Loading
							</>
						) : (
							<>
								<Plus className="h-4 w-4" />
								Add to shelf
							</>
						)}
					</button>
				</div>
			)}
		</section>
	);
}
