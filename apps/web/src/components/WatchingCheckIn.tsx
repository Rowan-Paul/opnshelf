import {
	formatRuntime,
	type StartCheckInDto,
	slugifyName,
	type WatchingCheckInDto,
} from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import {
	CalendarClock,
	CalendarOff,
	Check,
	ChevronDown,
	Film,
	History,
	type LucideIcon,
	Play,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { WatchDateFields } from "#/components/WatchDatePicker";
import {
	type WatchHistoryEntry,
	YourActivity,
	type YourActivityProps,
} from "#/components/YourActivity";
import { useAuth } from "#/lib/auth-context";
import { formatDate, formatDateTime } from "#/lib/date-utils";
import { useMovieDetails, useShowDetails } from "#/lib/hooks/useMedia";
import {
	useCheckInSuggestion,
	useWatchingCheckIn,
} from "#/lib/use-watching-check-in";
import { cn } from "#/lib/utils";

const shelfRow =
	"btn btn-ghost h-auto min-h-9 w-full items-start justify-start gap-3 px-2.5 py-1.5 text-left";

function ShelfRowLabel({
	icon: Icon,
	title,
	description,
}: {
	icon: LucideIcon;
	title: string;
	description?: string;
}) {
	return (
		<>
			<span
				className={cn(
					"grid size-7 shrink-0 place-items-center",
					description && "mt-0.5",
				)}
			>
				<Icon className="size-4" aria-hidden="true" />
			</span>
			<span
				className={cn("grid min-w-0 gap-0.5", !description && "self-center")}
			>
				<span className="font-semibold leading-5">{title}</span>
				{description && (
					<span className="font-normal text-(--foreground-muted) text-xs leading-4">
						{description}
					</span>
				)}
			</span>
		</>
	);
}

export function ShelfWatchButton({
	title,
	history,
	target,
	count,
	busy,
	onLog,
	onRemove,
}: {
	title: string;
	history: YourActivityProps & {
		onEditEntry: (id: string, date: string | null) => Promise<unknown>;
	};
	target: StartCheckInDto;
	count: number;
	busy: boolean;
	onLog: (date?: string | null) => void;
	onRemove: () => void;
}) {
	const checkIn = useWatchingCheckIn();
	const [open, setOpen] = useState(false);
	const [replace, setReplace] = useState<WatchingCheckInDto>();
	const { userSettings } = useAuth();
	const [watchDialogOpen, setWatchDialogOpen] = useState(false);
	const [addDateMode, setAddDateMode] = useState(false);
	const [editingWatch, setEditingWatch] = useState<WatchHistoryEntry>();
	const editingPending =
		!!editingWatch && !!history.updatingEntryIds?.includes(editingWatch.id);
	const historyHeading = useRef<HTMLDivElement>(null);
	const closeDate = () => {
		if (editingWatch) {
			setEditingWatch(undefined);
			requestAnimationFrame(() => historyHeading.current?.focus());
		} else {
			setWatchDialogOpen(false);
		}
	};
	const menuTrigger = useRef<HTMLButtonElement>(null);
	const historyTrigger = useRef<HTMLButtonElement>(null);
	const dialogReturnFocus = useRef<HTMLButtonElement | null>(null);
	const removeAfterHistory = useRef(false);
	const latest = history.watchHistory.find(
		(entry) => entry.watchedDate,
	)?.watchedDate;
	const watchSummary = latest
		? `${count > 1 ? "Last watched" : "Watched"} ${formatDate(latest, userSettings?.timezone)}`
		: history.watchHistory.length > 0
			? "Watched · No date"
			: null;
	const openHistory = (fromMenu: boolean) => {
		dialogReturnFocus.current = fromMenu
			? menuTrigger.current
			: historyTrigger.current;
		setOpen(false);
		setAddDateMode(false);
		setWatchDialogOpen(true);
	};
	const active = checkIn.active;
	const watching =
		active?.mediaId === target.mediaId &&
		active.seasonNumber === (target.seasonNumber ?? null) &&
		active.episodeNumber === (target.episodeNumber ?? null);
	const log = (date?: string | null) => {
		setOpen(false);
		onLog(date);
	};
	const start = () => {
		setOpen(false);
		if (active) setReplace(active);
		else checkIn.start(target);
	};
	const label = watching
		? "Now watching"
		: count
			? `On shelf (${count})`
			: "Add to shelf";
	const variant = watching || count ? "btn-secondary" : "btn-primary";
	return (
		<>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverAnchor asChild>
					<div className="inline-flex">
						<button
							type="button"
							className={`btn ${variant} min-w-36 rounded-r-none`}
							disabled={busy || checkIn.pending}
							aria-busy={busy}
							onClick={() => (watching || count ? setOpen(!open) : log())}
						>
							{!watching && !count && <Plus className="size-4" />}
							{label}
						</button>
						<PopoverTrigger asChild>
							<button
								type="button"
								aria-label="Shelf actions"
								ref={menuTrigger}
								disabled={busy || checkIn.pending}
								className={`btn ${variant} rounded-l-none border-current/20 border-l px-2`}
							>
								<ChevronDown className="size-4" />
							</button>
						</PopoverTrigger>
					</div>
				</PopoverAnchor>
				<PopoverContent
					align="start"
					onCloseAutoFocus={(event) => {
						if (dialogReturnFocus.current) event.preventDefault();
					}}
					className="grid w-[min(19rem,calc(100vw-2rem))] gap-0.5 rounded-xl p-2 shadow-lg"
				>
					<p className="px-3 py-1.5 font-semibold text-(--foreground-muted) text-xs">
						{watching ? "Now watching" : count ? "Watch again" : "Add to shelf"}
					</p>
					{watching ? (
						<>
							<button
								type="button"
								className={shelfRow}
								disabled={checkIn.pending}
								onClick={() => {
									setOpen(false);
									checkIn.finish();
								}}
							>
								<ShelfRowLabel
									icon={Check}
									title={active.finishing ? "Try logging again" : "I’m done"}
									description="Log a Watch dated when you started"
								/>
							</button>
							<button
								type="button"
								className={shelfRow}
								disabled={active.finishing || checkIn.pending}
								onClick={() => {
									setOpen(false);
									checkIn.cancel();
								}}
							>
								<ShelfRowLabel
									icon={X}
									title="Cancel check-in"
									description="No Watch is logged"
								/>
							</button>
						</>
					) : (
						<>
							<button
								type="button"
								className={shelfRow}
								disabled={active?.finishing || checkIn.pending}
								onClick={start}
							>
								<ShelfRowLabel
									icon={Play}
									title="Start watching now"
									description="Logs a Watch when the check-in ends"
								/>
							</button>
							{count > 0 && (
								<button
									type="button"
									className={shelfRow}
									onClick={() => log()}
								>
									<ShelfRowLabel
										icon={Check}
										title="Just finished"
										description="Logs a Watch at the current time"
									/>
								</button>
							)}
							<button
								type="button"
								className={shelfRow}
								aria-haspopup="dialog"
								onClick={() => {
									dialogReturnFocus.current = menuTrigger.current;
									setOpen(false);
									setAddDateMode(true);
									setWatchDialogOpen(true);
								}}
							>
								<ShelfRowLabel
									icon={CalendarClock}
									title="Pick a date and time…"
									description="Log a Watch from earlier"
								/>
							</button>
							<button
								type="button"
								className={shelfRow}
								onClick={() => log(null)}
							>
								<ShelfRowLabel
									icon={CalendarOff}
									title="No date"
									description="Log a Watch without a date"
								/>
							</button>
						</>
					)}
					{count > 0 && (
						<div className="mt-1 grid gap-0.5 border-(--border) border-t pt-1">
							<button
								type="button"
								className={shelfRow}
								onClick={() => openHistory(true)}
							>
								<ShelfRowLabel icon={History} title="Watch history…" />
							</button>
							{!watching && (
								<button
									type="button"
									className={shelfRow}
									onClick={() => {
										setOpen(false);
										onRemove();
									}}
								>
									<ShelfRowLabel icon={Trash2} title="Remove from shelf" />
								</button>
							)}
						</div>
					)}
				</PopoverContent>
			</Popover>
			<div className="order-last flex min-h-6 basis-full flex-wrap items-center gap-x-2 text-(--foreground-muted) text-xs">
				{count > 0 && (
					<Button
						type="button"
						variant="link"
						size="xs"
						ref={historyTrigger}
						className={cn(
							"px-0",
							watchSummary &&
								"font-normal text-(--foreground-muted) hover:text-(--accent-text)",
						)}
						onClick={() => openHistory(false)}
						aria-haspopup="dialog"
					>
						{watchSummary ?? "Watch history"}
					</Button>
				)}
			</div>
			<Dialog
				open={watchDialogOpen}
				onOpenChange={(next) => {
					if (next || (addDateMode && busy) || editingPending) return;
					if (addDateMode || editingWatch) closeDate();
					else setWatchDialogOpen(false);
				}}
			>
				<DialogContent
					className="sm:max-w-md"
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						const trigger = dialogReturnFocus.current;
						dialogReturnFocus.current = null;
						(trigger?.isConnected ? trigger : menuTrigger.current)?.focus();
						if (removeAfterHistory.current) {
							removeAfterHistory.current = false;
							onRemove();
						}
					}}
				>
					{addDateMode || editingWatch ? (
						<>
							<DialogHeader>
								<DialogTitle>
									{editingWatch ? "Edit watch date" : "Pick a date and time"}
								</DialogTitle>
								<DialogDescription>
									{editingWatch ? title : "Log a Watch from earlier."}
								</DialogDescription>
							</DialogHeader>
							<WatchDateFields
								key={editingWatch?.id ?? "new"}
								initialWatchedAt={
									editingWatch ? (editingWatch.watchedDate ?? null) : undefined
								}
								isPending={editingWatch ? editingPending : busy}
								onConfirm={
									editingWatch
										? (date) => history.onEditEntry(editingWatch.id, date)
										: log
								}
								onClose={closeDate}
								focusOnMount={!!editingWatch}
							/>
						</>
					) : (
						<>
							<DialogHeader ref={historyHeading} tabIndex={-1}>
								<DialogTitle>Watch history</DialogTitle>
								<DialogDescription>{title}</DialogDescription>
							</DialogHeader>
							<YourActivity {...history} onRequestEdit={setEditingWatch} />
							<div className="flex flex-wrap items-center justify-end gap-2 border-(--border) border-t pt-3">
								{count > 0 && (
									<button
										type="button"
										className="btn btn-ghost mr-auto gap-2 text-destructive"
										disabled={busy || history.isDeletePending}
										onClick={() => {
											removeAfterHistory.current = true;
											setWatchDialogOpen(false);
										}}
									>
										<Trash2 className="size-4" aria-hidden="true" />
										Remove from shelf
									</button>
								)}
								<button
									type="button"
									className="btn btn-secondary"
									onClick={() => setWatchDialogOpen(false)}
								>
									Done
								</button>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>
			<Dialog
				open={!!replace}
				onOpenChange={(show) => {
					if (!show) setReplace(undefined);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Replace your check-in?</DialogTitle>
						<DialogDescription>
							End your check-in for {replace?.title} and start watching this
							title.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-wrap justify-end gap-2">
						<button
							type="button"
							className="btn btn-secondary"
							onClick={() => setReplace(undefined)}
						>
							Keep watching
						</button>
						<button
							type="button"
							className="btn btn-primary"
							onClick={() => {
								if (!replace) return;
								checkIn.start({ ...target, replaceId: replace.rkey });
								setReplace(undefined);
							}}
						>
							Replace check-in
						</button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

const dockPosition =
	"pointer-events-none sticky bottom-0 z-30 mt-auto px-3 pb-3 sm:px-6 sm:pb-5";

export function WatchingDock() {
	const { userSettings } = useAuth();
	const { active, pending, finish, cancel, start } = useWatchingCheckIn(true);
	const { completed, suggestion, clearSuggestion, lookingUp } =
		useCheckInSuggestion(!!active);
	const displayed = active ?? (lookingUp ? completed : undefined);
	const movie = useMovieDetails(
		displayed?.episodeNumber == null ? (displayed?.mediaId ?? "") : "",
	);
	const show = useShowDetails(
		displayed?.episodeNumber != null ? displayed.mediaId : "",
	);
	if (!displayed) {
		if (!completed || !suggestion) return null;
		const { title, artworkPath, runtime } = suggestion;
		const episode = suggestion.kind === "episode" ? suggestion : null;
		const status = episode
			? `Watch logged for S${completed.seasonNumber} E${completed.episodeNumber}`
			: "Watch logged";
		const label =
			suggestion.kind === "episode"
				? `Up next · ${suggestion.showName ? `${suggestion.showName} · ` : ""}S${suggestion.target.seasonNumber} E${suggestion.target.episodeNumber}`
				: suggestion.kind === "collection"
					? "Next in collection"
					: "Similar movie";
		const metadata = [
			suggestion.kind === "episode"
				? undefined
				: suggestion.releaseDate?.slice(0, 4),
			formatRuntime(runtime),
		]
			.filter(Boolean)
			.join(" · ");
		return (
			<aside aria-label="Watching dock" className={dockPosition}>
				<div className="card pointer-events-auto mx-auto max-w-3xl border-(--border-strong) p-3 shadow-xl sm:px-4">
					<div className="flex items-center justify-between gap-2 border-(--border) border-b pb-2">
						<output className="flex items-center gap-1.5 font-semibold text-(--foreground-muted) text-xs">
							<Check className="size-4" aria-hidden="true" />
							{status}
						</output>
						<button
							type="button"
							aria-label="Dismiss suggestion"
							className="btn btn-ghost size-8 p-0"
							onClick={clearSuggestion}
						>
							<X className="size-4" aria-hidden="true" />
						</button>
					</div>
					<div className="flex flex-wrap items-center gap-3 pt-3">
						{artworkPath && (
							<img
								alt=""
								src={`https://image.tmdb.org/t/p/w185${artworkPath}`}
								className={cn(
									"h-12 shrink-0 rounded-md object-cover",
									episode ? "w-20" : "w-8",
								)}
							/>
						)}
						<div className="min-w-32 flex-1">
							<p className="text-(--foreground-muted) text-xs">{label}</p>
							{suggestion.kind === "episode" ? (
								<p className="font-semibold text-sm">{title}</p>
							) : (
								<Link
									to="/movies/$movieId/$movieName"
									params={{
										movieId: suggestion.movieId,
										movieName: slugifyName(title),
									}}
									className="font-semibold text-sm hover:underline"
								>
									{title}
								</Link>
							)}
							{metadata ? (
								<p className="text-(--foreground-muted) text-xs">{metadata}</p>
							) : null}
						</div>
						<button
							type="button"
							className="btn btn-primary gap-2 max-sm:w-full"
							disabled={pending}
							onClick={() =>
								start(
									suggestion.kind === "episode"
										? suggestion.target
										: { mediaId: suggestion.movieId },
								)
							}
						>
							<Play className="size-4" aria-hidden="true" />
							Start watching
						</button>
					</div>
				</div>
			</aside>
		);
	}
	const poster = movie.data?.poster_path ?? show.data?.poster_path;
	const timing = displayed.endsAt
		? `Ends ${formatDateTime(displayed.endsAt, userSettings?.timezone, userSettings?.timeFormat)}`
		: "Finish when you’re done";
	return (
		<aside aria-label="Watching dock" className={dockPosition}>
			<div className="card pointer-events-auto mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 border-(--border-strong) p-3 shadow-xl sm:px-4">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					{poster ? (
						<img
							alt=""
							src={`https://image.tmdb.org/t/p/w92${poster}`}
							className="h-12 w-8 shrink-0 rounded-sm object-cover"
						/>
					) : (
						<div className="grid h-12 w-8 shrink-0 place-items-center rounded-sm bg-(--background-subtle)">
							<Film className="size-4 text-(--foreground-muted)" />
						</div>
					)}
					<div className="min-w-0">
						<p className="flex items-center gap-1.5 font-semibold text-(--foreground-muted) text-xs">
							<span
								aria-hidden="true"
								className="size-1.5 shrink-0 rounded-full bg-accent"
							/>
							{lookingUp
								? "Watch logged"
								: displayed.finishing
									? "Logging Watch"
									: "Now watching"}
						</p>
						{displayed.seasonNumber != null &&
						displayed.episodeNumber != null ? (
							<Link
								to="/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber"
								params={{
									showId: displayed.mediaId,
									showName: slugifyName(show.data?.name ?? displayed.title),
									seasonNumber: String(displayed.seasonNumber),
									episodeNumber: String(displayed.episodeNumber),
								}}
								className="block truncate font-semibold text-sm hover:underline"
							>
								{displayed.title}
							</Link>
						) : (
							<Link
								to="/movies/$movieId/$movieName"
								params={{
									movieId: displayed.mediaId,
									movieName: slugifyName(displayed.title),
								}}
								className="block truncate font-semibold text-sm hover:underline"
							>
								{displayed.title}
							</Link>
						)}
						{!displayed.finishing || lookingUp ? (
							<p className="text-(--foreground-muted) text-xs">
								{lookingUp ? "Finding what to watch next…" : timing}
							</p>
						) : null}
					</div>
				</div>
				{!lookingUp && (
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className="btn btn-primary"
							disabled={pending}
							onClick={finish}
						>
							{displayed.finishing ? "Retry" : "I’m done"}
						</button>
						{!displayed.finishing && (
							<button
								type="button"
								className="btn btn-ghost"
								disabled={pending}
								onClick={cancel}
							>
								Cancel check-in
							</button>
						)}
					</div>
				)}
			</div>
		</aside>
	);
}
