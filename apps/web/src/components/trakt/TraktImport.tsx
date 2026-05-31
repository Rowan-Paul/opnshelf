import {
	getTraktImportStatusMessage,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	isKnownTraktImportStatus,
	isTerminalTraktImportStatus,
	type TraktImportStatusJob,
	usersControllerFetchMyTraktPublicHistory,
	usersControllerGetMyCurrentTraktImportOptions,
	usersControllerStartMyTraktImport,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowRight,
	CheckCircle,
	Film,
	Loader2,
	Tv,
	Upload,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function TraktAvatar({ url, name }: { url?: string; name: string }) {
	const [error, setError] = useState(false);

	if (!url || error) {
		return (
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--accent-subtle)">
				<Tv className="size-5 text-(--accent)" />
			</div>
		);
	}

	return (
		<img
			src={url}
			alt={name}
			className="h-10 w-10 shrink-0 rounded-full object-cover"
			referrerPolicy="no-referrer"
			onError={() => setError(true)}
		/>
	);
}

type TraktImportProps = {
	/** Section title rendered in the header row. */
	title: string;
	/** Supporting copy under the title. */
	description: string;
	/** Override the heading typography (defaults to the onboarding `text-display-3`). */
	titleClassName?: string;
	/** Wizard-only: render a "Skip" affordance (hidden once an import is shown). */
	onSkip?: () => void;
	/** Wizard-only: advance to the next step after a finished import. When omitted
	 *  (e.g. Settings) the completion panel offers a "Done" reset instead. */
	onComplete?: () => void;
	/**
	 * Idle behaviour. When true (Settings), the username input is the default and
	 * only an *active* import auto-opens the progress panel — a recent terminal
	 * job is surfaced as a note above the input. When false (onboarding), the
	 * component resumes into the panel for any known job, active or terminal.
	 */
	idleShowsInput?: boolean;
};

/**
 * Trakt public-history importer: username → preview → background import with a
 * polled progress panel. Shared by the onboarding wizard and the Settings page
 * so wording and behaviour stay in lockstep. The backend dedupes already-imported
 * items, so re-running is safe.
 */
export function TraktImport({
	title,
	description,
	titleClassName = "text-display-3",
	onSkip,
	onComplete,
	idleShowsInput = false,
}: TraktImportProps) {
	const [username, setUsername] = useState("");
	const [previewData, setPreviewData] = useState<{
		profile: { username: string; name?: string; avatarUrl?: string };
		importableCount: number;
		previewItems: Array<{
			type: "movie" | "episode";
			title: string;
			subtitle?: string;
			watchedAt: string;
		}>;
	} | null>(null);
	const [jobData, setJobData] = useState<TraktImportStatusJob | null>(null);
	const [fetchError, setFetchError] = useState("");
	const queryClient = useQueryClient();

	const fetchPreview = useMutation({
		mutationKey: ["trakt", "fetch-preview"],
		mutationFn: async (body: { username: string }) => {
			const { data } = await usersControllerFetchMyTraktPublicHistory({
				body,
				throwOnError: true,
			});
			return data;
		},
		onSuccess: (data) => {
			setPreviewData(data);
			setFetchError("");
		},
		onError: (error: unknown) => {
			const message =
				typeof error === "object" && error !== null && "message" in error
					? String((error as { message?: string }).message)
					: "Could not fetch Trakt history. Please check the username and try again.";
			setFetchError(message);
			toast.error(message);
		},
	});

	const startImport = useMutation({
		mutationKey: ["trakt", "start-import"],
		mutationFn: async (body: { username: string }) => {
			const { data } = await usersControllerStartMyTraktImport({
				body,
				throwOnError: true,
			});
			return data;
		},
		onSuccess: (data) => {
			toast.success("Import started");
			if (data.job) {
				setJobData({
					status: data.job.status,
					currentPage: data.job.currentPage,
					totalPages: data.job.totalPages,
					importedCount: data.job.importedCount,
					skippedCount: data.job.skippedCount,
					failedCount: data.job.failedCount,
					lastError: data.job.lastError,
				});
				// Force an immediate refetch of the import status
				queryClient.invalidateQueries({
					queryKey: usersControllerGetMyCurrentTraktImportOptions().queryKey,
				});
			}
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to start import",
			);
		},
	});

	// Fetch existing import and poll while active
	const { data: currentImport } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		refetchInterval:
			jobData && isActiveTraktImportStatus(jobData.status) ? 3000 : false,
	});

	useEffect(() => {
		if (!currentImport?.id || !isKnownTraktImportStatus(currentImport.status)) {
			return;
		}
		const active = isActiveTraktImportStatus(currentImport.status);
		setJobData((prev) => {
			// Settings mode: don't adopt a *pre-existing* terminal job into the panel
			// (it shows as a note instead). Once we're already tracking a job, keep it
			// updated through to its terminal state so polling can stop correctly.
			if (idleShowsInput && !active && !prev) return prev;
			return {
				status: currentImport.status,
				currentPage: currentImport.currentPage,
				totalPages: currentImport.totalPages,
				importedCount: currentImport.importedCount,
				skippedCount: currentImport.skippedCount,
				failedCount: currentImport.failedCount,
				lastError: currentImport.lastError,
			};
		});
	}, [currentImport, idleShowsInput]);

	const handleFetch = () => {
		if (!username.trim()) return;
		setPreviewData(null);
		setJobData(null);
		fetchPreview.mutate({ username: username.trim() });
	};

	const handleStartImport = () => {
		if (!username.trim()) return;
		startImport.mutate({ username: username.trim() });
	};

	const resetToInput = () => {
		setJobData(null);
		setPreviewData(null);
		setUsername("");
		// Reflect the freshly-imported Watches on the user's shelf.
		queryClient.invalidateQueries({ queryKey: ["shelf"] });
	};

	const isImportDone = jobData && isTerminalTraktImportStatus(jobData.status);
	const progress = jobData ? getTraktImportStatusProgress(jobData) : null;
	const statusMessage = jobData ? getTraktImportStatusMessage(jobData) : null;

	// Settings-only note for a recent terminal job while the input is shown.
	const terminalNote =
		idleShowsInput &&
		!jobData &&
		currentImport?.id &&
		isTerminalTraktImportStatus(currentImport.status)
			? currentImport
			: null;

	return (
		<div>
			<div className="mb-6 flex items-start justify-between gap-4">
				<div>
					<h2 className={titleClassName}>{title}</h2>
					<p className="mt-1 text-(--foreground-muted) text-sm">
						{description}
					</p>
				</div>
				{onSkip && !jobData && (
					<button
						type="button"
						onClick={onSkip}
						className="shrink-0 text-(--foreground-muted) text-sm hover:text-(--foreground)"
					>
						Skip
					</button>
				)}
			</div>

			{/* Recent terminal job note (Settings) */}
			{terminalNote &&
				(terminalNote.status === "failed" ? (
					<div className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-red-800 text-sm dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
						<AlertTriangle className="mt-0.5 size-4 shrink-0" />
						<span>
							Your last import failed.{" "}
							{getTraktImportStatusMessage(terminalNote)} You can try again
							below.
						</span>
					</div>
				) : (
					<p className="mb-4 text-(--foreground-muted) text-sm">
						Last import: {getTraktImportStatusMessage(terminalNote)}
					</p>
				))}

			{/* Username input */}
			{!previewData && !jobData && (
				<div className="space-y-4">
					<div>
						<label
							htmlFor="trakt-username"
							className="mb-1.5 block font-medium text-sm"
						>
							Trakt Username
						</label>
						<input
							id="trakt-username"
							type="text"
							placeholder="your-trakt-username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							className="input"
							onKeyDown={(e) => {
								if (e.key === "Enter") handleFetch();
							}}
						/>
						<p className="mt-1.5 text-(--foreground-subtle) text-xs">
							Items you&apos;ve already imported are skipped automatically, so
							it&apos;s safe to run this again.
						</p>
					</div>
					{fetchError && <p className="text-red-500 text-sm">{fetchError}</p>}
					<button
						type="button"
						onClick={handleFetch}
						disabled={fetchPreview.isPending || !username.trim()}
						className="btn btn-primary w-full"
					>
						{fetchPreview.isPending ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Fetching preview...
							</>
						) : (
							<>
								<Upload className="size-4" />
								Preview History
							</>
						)}
					</button>
				</div>
			)}

			{/* Preview results */}
			{previewData && !jobData && (
				<div className="space-y-4">
					<div className="flex items-center gap-3 rounded-lg bg-(--background-subtle) p-3">
						<TraktAvatar
							url={previewData.profile.avatarUrl}
							name={previewData.profile.username}
						/>
						<div>
							<p className="font-medium text-sm">
								{previewData.profile.name || previewData.profile.username}
							</p>
							<p className="text-(--foreground-muted) text-xs">
								@{previewData.profile.username}
							</p>
						</div>
					</div>

					{previewData.previewItems.length > 0 && (
						<div className="space-y-2">
							<p className="font-medium text-sm">Recent items</p>
							{previewData.previewItems.map((item) => (
								<div
									key={`${item.title}-${item.watchedAt}`}
									className="flex items-center gap-3 rounded-lg border border-(--border) bg-(--background-elevated) p-3"
								>
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-(--accent-subtle)">
										{item.type === "movie" ? (
											<Film className="size-4 text-(--accent)" />
										) : (
											<Tv className="size-4 text-(--accent)" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm">{item.title}</p>
										{item.subtitle && (
											<p className="truncate text-(--foreground-muted) text-xs">
												{item.subtitle}
											</p>
										)}
									</div>
								</div>
							))}
						</div>
					)}

					<div className="flex gap-3">
						<button
							type="button"
							onClick={() => {
								setPreviewData(null);
								setUsername("");
							}}
							className="btn btn-secondary flex-1"
						>
							<X className="size-4" />
							Change
						</button>
						<button
							type="button"
							onClick={handleStartImport}
							disabled={startImport.isPending}
							className="btn btn-primary flex-1"
						>
							{startImport.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<>
									<Upload className="size-4" />
									Start Import
								</>
							)}
						</button>
					</div>
				</div>
			)}

			{/* Import progress */}
			{jobData && (
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						{isImportDone ? (
							<CheckCircle className="size-5 text-green-500" />
						) : (
							<Loader2 className="size-5 animate-spin text-(--accent)" />
						)}
						<div>
							<p className="font-medium text-sm">
								{isImportDone ? "Import finished" : "Importing..."}
							</p>
							{statusMessage && (
								<p className="text-(--foreground-muted) text-xs">
									{statusMessage}
								</p>
							)}
						</div>
					</div>

					{typeof progress === "number" && (
						<div className="space-y-1">
							<div className="h-2 w-full overflow-hidden rounded-full bg-(--background-subtle)">
								<div
									className="h-full rounded-full bg-(--accent) transition-all duration-500"
									style={{ width: `${progress}%` }}
								/>
							</div>
							<p className="text-right text-(--foreground-muted) text-xs">
								{progress}%
							</p>
						</div>
					)}

					{isImportDone && (
						<button
							type="button"
							onClick={() => {
								resetToInput();
								onComplete?.();
							}}
							className="btn btn-primary w-full"
						>
							{onComplete ? (
								<>
									Continue
									<ArrowRight className="size-4" />
								</>
							) : (
								"Done"
							)}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
