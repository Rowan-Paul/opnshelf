import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { WatchCountBadge } from "#/components/WatchCountBadge";
import { useAuth } from "#/lib/auth-context";
import { datetimeLocalToISO, formatDateTime } from "#/lib/date-utils";

interface WatchHistoryEntry {
	id: string;
	watchedDate?: string;
}

interface YourActivityProps {
	watchHistory: WatchHistoryEntry[];
	onAddToShelf: (watchedAt?: string) => void;
	onDeleteEntry: (id: string) => void;
	isAddPending?: boolean;
	isDeletePending?: boolean;
}

function getCurrentDatetimeLocal(timezone?: string): string {
	const now = new Date();
	const options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: timezone,
	};
	const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(now);
	const getPart = (type: string) =>
		parts.find((p) => p.type === type)?.value ?? "00";
	return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`;
}

function AddToShelfButton({
	isPending,
	onConfirm,
	className,
}: {
	isPending: boolean;
	onConfirm: (watchedAt: string) => void;
	className?: string;
}) {
	const { userSettings } = useAuth();
	const userTimezone = userSettings?.timezone;
	const [open, setOpen] = useState(false);
	const [watchedAt, setWatchedAt] = useState(() =>
		getCurrentDatetimeLocal(userTimezone),
	);

	const handleOpenChange = (isOpen: boolean) => {
		if (isOpen) {
			setWatchedAt(getCurrentDatetimeLocal(userTimezone));
		}
		setOpen(isOpen);
	};

	const handleConfirm = () => {
		onConfirm(datetimeLocalToISO(watchedAt, userTimezone));
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					disabled={isPending}
					className={`btn btn-secondary gap-2 ${className ?? ""}`}
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
			</PopoverTrigger>
			<PopoverContent className="w-80 space-y-3">
				<div className="space-y-2">
					<label htmlFor="watched-at" className="block font-medium text-sm">
						When did you watch this?
					</label>
					<input
						id="watched-at"
						type="datetime-local"
						value={watchedAt}
						onChange={(e) => setWatchedAt(e.target.value)}
						className="w-full rounded-md border bg-(--background) px-3 py-2 text-sm outline-hidden focus:ring-(--accent) focus:ring-2"
					/>
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => setOpen(false)}
						className="btn btn-secondary flex-1"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleConfirm}
						disabled={isPending}
						className="btn btn-primary flex-1"
					>
						Confirm
					</button>
				</div>
			</PopoverContent>
		</Popover>
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
					<AddToShelfButton
						isPending={isAddPending}
						onConfirm={onAddToShelf}
						className="mt-3 w-full"
					/>
				</div>
			) : (
				<div className="space-y-3">
					<p className="text-(--foreground-muted) text-sm">
						You haven&apos;t watched this yet
					</p>
					<AddToShelfButton
						isPending={isAddPending}
						onConfirm={onAddToShelf}
						className="w-full text-sm"
					/>
				</div>
			)}
		</section>
	);
}
