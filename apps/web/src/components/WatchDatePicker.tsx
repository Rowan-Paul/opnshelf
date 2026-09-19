import { Loader2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { useAuth } from "#/lib/auth-context";
import { datetimeLocalToISO, nowAsDatetimeLocal } from "#/lib/date-utils";

/**
 * Picks the date for a new Watch, or declines to give one.
 *
 * A Watch's date is optional: `undefined` means "use the current time",
 * a string means "this instant", and `null` means an undated Watch — a
 * deliberate "I watched this, I'm not saying when", used for backfilling
 * history. This is the only surface on web that offers the undated choice;
 * one-tap surfaces (cards, quick actions, Up Next) always mean "now".
 */
export function WatchDatePicker({
	isPending,
	onConfirm,
	trigger,
	align,
}: {
	isPending: boolean;
	/** `null` creates an undated Watch; a string is a UTC ISO instant. */
	onConfirm: (watchedAt: string | null) => void;
	trigger: ReactNode;
	align?: "start" | "center" | "end";
}) {
	const { userSettings } = useAuth();
	const userTimezone = userSettings?.timezone;
	const [open, setOpen] = useState(false);
	const [watchedAt, setWatchedAt] = useState(() =>
		nowAsDatetimeLocal(userTimezone),
	);

	// `max` only marks the input invalid; it does not stop a plain button's
	// click handler, and the field is typeable. Gate Confirm on the same value
	// so a future date cannot be submitted.
	const latestAllowed = nowAsDatetimeLocal(userTimezone);
	const isFuture = watchedAt > latestAllowed;

	// Re-seed on every open so a picker left mounted never offers a stale "now".
	const handleOpenChange = (isOpen: boolean) => {
		if (isOpen) setWatchedAt(nowAsDatetimeLocal(userTimezone));
		setOpen(isOpen);
	};

	const handleConfirm = () => {
		onConfirm(datetimeLocalToISO(watchedAt, userTimezone));
		setOpen(false);
	};

	const handleNoDate = () => {
		onConfirm(null);
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			{/* The trailing-calendar trigger can sit near a viewport edge, where
			    Radix clamps the popover flush against it. Keep a little air. */}
			<PopoverContent
				align={align}
				collisionPadding={8}
				className="w-80 space-y-3"
			>
				<div className="space-y-2">
					<label htmlFor="watched-at" className="block font-medium text-sm">
						When did you watch this?
					</label>
					<input
						id="watched-at"
						type="datetime-local"
						value={watchedAt}
						// You cannot have watched something you have not watched yet.
						max={latestAllowed}
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
						// An empty field is not a way to say "undated": "No date" is.
						disabled={isPending || watchedAt === "" || isFuture}
						className="btn btn-primary flex-1"
					>
						{isPending ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							"Confirm"
						)}
					</button>
				</div>
				<button
					type="button"
					onClick={handleNoDate}
					disabled={isPending}
					className="w-full text-center text-(--muted-foreground) text-sm underline-offset-4 hover:underline disabled:opacity-50"
				>
					No date
				</button>
			</PopoverContent>
		</Popover>
	);
}
