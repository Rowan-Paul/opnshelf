import { Pencil, Trash2 } from "lucide-react";
import { WatchCountBadge } from "#/components/WatchCountBadge";
import { useAuth } from "#/lib/auth-context";
import { formatDateTime } from "#/lib/date-utils";

export interface WatchHistoryEntry {
	id: string;
	watchedDate?: string;
}

export interface YourActivityProps {
	watchHistory: WatchHistoryEntry[];
	onDeleteEntry: (id: string) => void;
	onRequestEdit?: (entry: WatchHistoryEntry) => void;
	updatingEntryIds?: string[];
	isDeletePending?: boolean;
}

export function YourActivity({
	watchHistory,
	onDeleteEntry,
	onRequestEdit,
	updatingEntryIds = [],
	isDeletePending = false,
}: YourActivityProps) {
	const { userSettings } = useAuth();
	const userTimezone = userSettings?.timezone;
	const userTimeFormat = userSettings?.timeFormat;

	return (
		<section aria-label="Logged Watches">
			{watchHistory.length > 0 && (
				<WatchCountBadge
					watchCount={watchHistory.length}
					className={`absolute top-6 right-12 h-6 ${watchHistory.length > 1 ? "" : "w-6"}`}
				/>
			)}
			{watchHistory.length > 0 ? (
				<div className="max-h-[50dvh] space-y-1 overflow-y-auto">
					{watchHistory.map((entry, index) => {
						const date = entry.watchedDate
							? formatDateTime(entry.watchedDate, userTimezone, userTimeFormat)
							: "No date";
						return (
							<div
								key={entry.id || index}
								className="group flex items-center rounded-lg transition-colors hover:bg-(--background-subtle)"
							>
								<div className="flex flex-1 items-center p-2">
									<span className="font-medium text-sm">{date}</span>
								</div>
								{onRequestEdit && (
									<button
										type="button"
										disabled={updatingEntryIds.includes(entry.id)}
										aria-label={`Edit watch date, ${date}`}
										className="flex size-10 shrink-0 items-center justify-center rounded-md text-(--foreground-muted) hover:bg-(--background-subtle)"
										onClick={() => onRequestEdit(entry)}
									>
										<Pencil className="size-4" />
									</button>
								)}
								<button
									type="button"
									onClick={() => onDeleteEntry(entry.id)}
									disabled={
										isDeletePending || updatingEntryIds.includes(entry.id)
									}
									className="flex size-10 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-destructive/10 hover:text-destructive"
									aria-label={`Remove this watch, ${date}`}
								>
									<Trash2 className="size-4" />
								</button>
							</div>
						);
					})}
				</div>
			) : (
				<div className="space-y-3">
					<p className="text-(--foreground-muted) text-sm">
						No Watches logged yet
					</p>
				</div>
			)}
		</section>
	);
}
