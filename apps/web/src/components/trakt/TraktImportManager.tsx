import {
	getTraktImportStatusMessage,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	type TraktImportJobDto,
	type TraktMatchCandidateDto,
	type TraktUnmatchedGroupDto,
	usersControllerConfirmMyTraktMatchMutation,
	usersControllerGetMyCurrentTraktImportOptions,
	usersControllerGetMyCurrentTraktImportQueryKey,
	usersControllerGetMyTraktImportIssuesOptions,
	usersControllerGetMyTraktMatchCandidatesOptions,
	usersControllerPauseMyTraktImportMutation,
	usersControllerRejectMyTraktMatchMutation,
	usersControllerResumeMyTraktImportMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	ArrowRight,
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	CirclePause,
	Film,
	Loader2,
	Search,
	Tv,
	X,
} from "lucide-react";
import { useState } from "react";
import { TraktImport } from "#/components/trakt/TraktImport";
import { useAuth } from "#/lib/auth-context";

function ShelfLink({
	children,
	className,
}: {
	children: React.ReactNode;
	className: string;
}) {
	const { user } = useAuth();
	if (!user?.handle) return null;
	return (
		<Link
			to="/profile/$handle/shelf"
			params={{ handle: user.handle }}
			className={className}
		>
			{children}
		</Link>
	);
}

export function TraktImportManager() {
	const queryClient = useQueryClient();
	const { data: job, isLoading } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		refetchInterval: (query) => {
			const current = query.state.data;
			return current && isActiveTraktImportStatus(current.status)
				? 3000
				: false;
		},
	});
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: usersControllerGetMyCurrentTraktImportQueryKey(),
		});
	const pause = useMutation({
		mutationKey: ["trakt", "import", "pause"],
		...usersControllerPauseMyTraktImportMutation(),
		onSuccess: refresh,
	});
	const resume = useMutation({
		mutationKey: ["trakt", "import", "resume"],
		...usersControllerResumeMyTraktImportMutation(),
		onSuccess: refresh,
	});

	if (isLoading) {
		return (
			<div className="mx-auto h-80 max-w-3xl animate-pulse rounded-2xl bg-(--background-subtle)" />
		);
	}

	if (!job) {
		return (
			<div className="mx-auto max-w-2xl rounded-2xl border border-(--border) bg-(--background-elevated) p-6 sm:p-8">
				<TraktImport
					title="Import from Trakt"
					description="Bring your public watch history into your Shelf. We’ll preview the profile before anything starts."
					titleClassName="font-display font-semibold text-2xl"
				/>
			</div>
		);
	}

	if (isActiveTraktImportStatus(job.status)) {
		return (
			<ImportProgress
				job={job}
				onPause={() => pause.mutate({})}
				pausing={pause.isPending}
			/>
		);
	}

	if (job.status === "paused" || job.status === "failed") {
		return (
			<StoppedImport
				job={job}
				onResume={() => resume.mutate({})}
				resuming={resume.isPending}
			/>
		);
	}

	return <ImportResult job={job} />;
}

function ImportProgress({
	job,
	onPause,
	pausing,
}: {
	job: TraktImportJobDto;
	onPause: () => void;
	pausing: boolean;
}) {
	const progress = getTraktImportStatusProgress(job);
	return (
		<section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-(--border) bg-(--background-elevated)">
			<div className="border-(--border) border-b p-6 sm:p-8">
				<p className="mb-2 font-medium text-(--accent) text-sm">
					Importing @{job.profileUsername ?? job.traktUsername}
				</p>
				<h1 className="font-display font-semibold text-3xl">
					Building your Shelf
				</h1>
				<p className="mt-2 text-(--foreground-muted)">
					{getTraktImportStatusMessage(job)}
				</p>
			</div>
			<div className="space-y-6 p-6 sm:p-8">
				<div className="h-3 overflow-hidden rounded-full bg-(--background-subtle)">
					<div
						className="h-full rounded-full bg-(--accent) transition-[width] duration-500"
						style={{ width: `${progress ?? 4}%` }}
					/>
				</div>
				<div className="grid grid-cols-3 gap-3 text-center">
					<Metric value={job.importedCount} label="Imported" />
					<Metric value={job.alreadyOnShelfCount} label="Already here" />
					<Metric
						value={job.unmatchedCount + job.couldntImportCount}
						label="Need attention"
					/>
				</div>
				<div className="flex items-center justify-between gap-4">
					<p className="text-(--foreground-muted) text-sm">
						You can leave this page. The import continues in the background.
					</p>
					<button
						type="button"
						onClick={onPause}
						disabled={pausing}
						className="btn btn-secondary shrink-0"
					>
						{pausing ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<CirclePause className="size-4" />
						)}
						Pause import
					</button>
				</div>
			</div>
		</section>
	);
}

function StoppedImport({
	job,
	onResume,
	resuming,
}: {
	job: TraktImportJobDto;
	onResume: () => void;
	resuming: boolean;
}) {
	const paused = job.status === "paused";
	return (
		<section className="mx-auto max-w-2xl rounded-2xl border border-(--border) bg-(--background-elevated) p-6 sm:p-8">
			<div className="flex items-start gap-4">
				<div className="flex size-11 items-center justify-center rounded-full bg-amber-500/12 text-amber-600">
					{paused ? (
						<CirclePause className="size-5" />
					) : (
						<AlertTriangle className="size-5" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<p className="font-medium text-(--accent) text-sm">
						@{job.profileUsername ?? job.traktUsername}
					</p>
					<h1 className="mt-1 font-display font-semibold text-3xl">
						{paused ? "Import paused" : "Import stopped"}
					</h1>
					<p className="mt-3 text-(--foreground-muted)">
						{paused
							? "Resume whenever you’re ready. We’ll continue from the saved position."
							: (job.lastError ??
								"An error interrupted the import before all history was examined.")}
					</p>
					<button
						type="button"
						onClick={onResume}
						disabled={resuming}
						className="btn btn-primary mt-6"
					>
						{resuming ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<ArrowRight className="size-4" />
						)}
						Resume import
					</button>
				</div>
			</div>
		</section>
	);
}

function ImportResult({ job }: { job: TraktImportJobDto }) {
	const [matching, setMatching] = useState(false);
	const hasIssues = job.unmatchedCount > 0 || job.couldntImportCount > 0;
	if (matching && job.unmatchedGroups.length > 0) {
		return <MatchReel job={job} onFinish={() => setMatching(false)} />;
	}
	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<section className="overflow-hidden rounded-2xl border border-(--border) bg-(--background-elevated)">
				<div className="flex items-start gap-4 border-(--border) border-b p-6 sm:p-8">
					<div
						className={`flex size-12 shrink-0 items-center justify-center rounded-full ${hasIssues ? "bg-amber-500/12 text-amber-600" : "bg-green-500/12 text-green-600"}`}
					>
						{hasIssues ? (
							<AlertTriangle className="size-6" />
						) : (
							<CheckCircle2 className="size-6" />
						)}
					</div>
					<div>
						<p className="font-medium text-(--accent) text-sm">
							@{job.profileUsername ?? job.traktUsername}
						</p>
						<h1 className="mt-1 font-display font-semibold text-3xl">
							{hasIssues ? "Completed with issues" : "Import complete"}
						</h1>
						<p className="mt-2 text-(--foreground-muted)">
							{hasIssues
								? "Your full Trakt snapshot was examined. Some titles still need attention."
								: "Your full Trakt snapshot is now on your Shelf."}
						</p>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-px bg-(--border) sm:grid-cols-4">
					<Metric value={job.importedCount} label="Imported" panel />
					<Metric
						value={job.alreadyOnShelfCount}
						label="Already on Shelf"
						panel
					/>
					<Metric value={job.unmatchedCount} label="Unmatched" panel />
					<Metric
						value={job.couldntImportCount}
						label="Couldn’t import"
						panel
					/>
				</div>
				<div className="flex flex-wrap gap-3 p-6 sm:p-8">
					{job.unmatchedGroups.length > 0 ? (
						<button
							type="button"
							onClick={() => setMatching(true)}
							className="btn btn-primary"
						>
							Match {job.unmatchedGroups.length}{" "}
							{job.unmatchedGroups.length === 1 ? "title" : "titles"}
							<ArrowRight className="size-4" />
						</button>
					) : null}
					<ShelfLink
						className={
							job.unmatchedGroups.length > 0
								? "btn btn-secondary"
								: "btn btn-primary"
						}
					>
						View your Shelf <ArrowRight className="size-4" />
					</ShelfLink>
				</div>
			</section>
			{job.couldntImportCount > 0 ? <CouldntImportList /> : null}
		</div>
	);
}

function MatchReel({
	job,
	onFinish,
}: {
	job: TraktImportJobDto;
	onFinish: () => void;
}) {
	const group = job.unmatchedGroups[0];
	const total = job.unmatchedGroups.length;
	return (
		<section className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-(--border) bg-(--background-elevated)">
			<header className="flex items-center justify-between gap-4 border-(--border) border-b px-6 py-4">
				<div>
					<p className="font-medium text-(--accent) text-sm">Match reel</p>
					<h1 className="font-display font-semibold text-2xl">
						{total} {total === 1 ? "title needs" : "titles need"} your eye
					</h1>
				</div>
				<button type="button" onClick={onFinish} className="btn btn-ghost">
					Finish for now
				</button>
			</header>
			<MatchCard key={group.matchKey} group={group} />
		</section>
	);
}

function MatchCard({ group }: { group: TraktUnmatchedGroupDto }) {
	const queryClient = useQueryClient();
	const [candidateIndex, setCandidateIndex] = useState(0);
	const [searchMode, setSearchMode] = useState(false);
	const [searchText, setSearchText] = useState("");
	const [submittedSearch, setSubmittedSearch] = useState("");
	const { data: candidates = [], isLoading } = useQuery({
		...usersControllerGetMyTraktMatchCandidatesOptions({
			path: { matchKey: group.matchKey },
			query: submittedSearch ? { query: submittedSearch } : undefined,
		}),
	});
	const candidate = candidates[candidateIndex];
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: usersControllerGetMyCurrentTraktImportQueryKey(),
		});
	const confirm = useMutation({
		mutationKey: ["trakt", "matches", group.matchKey, "confirm"],
		...usersControllerConfirmMyTraktMatchMutation(),
		onSuccess: refresh,
	});
	const reject = useMutation({
		mutationKey: ["trakt", "matches", group.matchKey, "noMatch"],
		...usersControllerRejectMyTraktMatchMutation(),
		onSuccess: refresh,
	});

	const visibleCandidate = candidate;

	return (
		<div className="grid min-h-120 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
			<div className="flex flex-col justify-between border-(--border) border-b bg-(--background-subtle) p-6 sm:p-8 md:border-r md:border-b-0">
				<div>
					<p className="mb-5 font-medium text-(--foreground-muted) text-xs uppercase tracking-[0.18em]">
						From Trakt
					</p>
					<div className="flex items-center gap-3 text-(--accent)">
						{group.mediaType === "movie" ? (
							<Film className="size-5" />
						) : (
							<Tv className="size-5" />
						)}
						<span className="font-medium">
							{group.mediaType === "movie" ? "Movie" : "Show"}
						</span>
					</div>
					<h2 className="mt-5 text-balance font-display font-semibold text-4xl leading-tight">
						{group.title}
					</h2>
					{group.year ? (
						<p className="mt-2 text-(--foreground-muted) text-lg">
							{group.year}
						</p>
					) : null}
				</div>
				<div className="mt-10 rounded-xl border border-(--border) bg-(--background-elevated) p-4">
					<p className="font-semibold">
						{group.watchCount} {group.watchCount === 1 ? "Watch" : "Watches"}{" "}
						will be added
					</p>
					<p className="mt-1 text-(--foreground-muted) text-sm">
						{group.watchedAt
							.slice(0, 3)
							.map((date) => new Date(date).toLocaleDateString())
							.join(" · ")}
					</p>
				</div>
			</div>
			<div className="flex flex-col p-6 sm:p-8">
				<div className="flex items-center justify-between gap-3">
					<p className="font-medium text-(--foreground-muted) text-xs uppercase tracking-[0.18em]">
						Does this match?
					</p>
					{candidateIndex > 0 && !searchMode ? (
						<span className="text-(--foreground-muted) text-sm">
							Suggestion {candidateIndex + 1} of {candidates.length}
						</span>
					) : null}
				</div>
				{searchMode ? (
					<form
						className="mt-5 flex gap-2"
						onSubmit={(event) => {
							event.preventDefault();
							setCandidateIndex(0);
							setSubmittedSearch(searchText.trim());
						}}
					>
						<div className="relative flex-1">
							<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--foreground-muted)" />
							<input
								className="input pl-9"
								value={searchText}
								onChange={(event) => setSearchText(event.target.value)}
								placeholder="Search TMDB"
							/>
						</div>
						<button
							type="submit"
							className="btn btn-primary"
							disabled={!searchText.trim()}
						>
							Search
						</button>
						<button
							type="button"
							onClick={() => setSearchMode(false)}
							className="btn btn-secondary"
						>
							<X className="size-4" />
						</button>
					</form>
				) : null}
				<div className="flex flex-1 items-center justify-center py-8">
					{isLoading ? (
						<Loader2 className="size-8 animate-spin text-(--accent)" />
					) : visibleCandidate ? (
						<Candidate candidate={visibleCandidate} />
					) : (
						<div className="text-center">
							<Search className="mx-auto size-8 text-(--foreground-muted)" />
							<p className="mt-3 font-semibold">No suggestion found</p>
							<p className="mt-1 text-(--foreground-muted) text-sm">
								You can search or conclude that TMDB has no match.
							</p>
						</div>
					)}
				</div>
				<div className="space-y-3">
					{visibleCandidate ? (
						<div className="grid grid-cols-2 gap-3">
							<button
								type="button"
								onClick={() =>
									confirm.mutate({
										path: { matchKey: group.matchKey },
										body: { tmdbId: visibleCandidate.tmdbId },
									})
								}
								disabled={confirm.isPending}
								className="btn btn-primary"
							>
								<Check className="size-4" />
								Yes
							</button>
							<button
								type="button"
								onClick={() =>
									candidateIndex + 1 < candidates.length
										? setCandidateIndex((value) => value + 1)
										: setSearchMode(true)
								}
								className="btn btn-secondary"
							>
								<X className="size-4" />
								No
							</button>
						</div>
					) : null}
					<button
						type="button"
						onClick={() => setSearchMode(true)}
						className="btn btn-ghost w-full"
					>
						<Search className="size-4" />
						Search TMDB suggestions
					</button>
					{searchMode ? (
						<button
							type="button"
							onClick={() =>
								reject.mutate({ path: { matchKey: group.matchKey } })
							}
							disabled={reject.isPending}
							className="w-full py-2 text-(--foreground-muted) text-sm hover:text-(--foreground)"
						>
							No TMDB match exists
						</button>
					) : null}
				</div>
			</div>
		</div>
	);
}

function Candidate({ candidate }: { candidate: TraktMatchCandidateDto }) {
	return (
		<div className="flex max-w-md gap-5 rounded-2xl border border-(--border) bg-(--background-subtle) p-4">
			<div className="aspect-2/3 w-28 shrink-0 overflow-hidden rounded-xl bg-(--background-elevated)">
				{candidate.posterPath ? (
					<img
						src={`https://image.tmdb.org/t/p/w300${candidate.posterPath}`}
						alt=""
						className="h-full w-full object-cover"
					/>
				) : (
					<div className="flex h-full items-center justify-center text-(--foreground-muted)">
						{candidate.mediaType === "movie" ? <Film /> : <Tv />}
					</div>
				)}
			</div>
			<div className="min-w-0 py-2">
				<p className="font-display font-semibold text-xl">{candidate.title}</p>
				{candidate.year ? (
					<p className="mt-1 text-(--foreground-muted)">{candidate.year}</p>
				) : null}
				{candidate.overview ? (
					<p className="mt-4 line-clamp-4 text-(--foreground-muted) text-sm leading-6">
						{candidate.overview}
					</p>
				) : null}
			</div>
		</div>
	);
}

function CouldntImportList() {
	const [page, setPage] = useState(1);
	const { data } = useQuery({
		...usersControllerGetMyTraktImportIssuesOptions({
			query: { page, pageSize: 25, outcome: "couldnt_import" },
		}),
	});
	const items = data?.items ?? [];
	if (!data || items.length === 0) return null;
	const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
	return (
		<section className="rounded-2xl border border-(--border) bg-(--background-elevated) p-6 sm:p-8">
			<h2 className="font-display font-semibold text-2xl">
				Items that couldn’t be imported
			</h2>
			<p className="mt-1 text-(--foreground-muted) text-sm">
				Showing {(page - 1) * data.pageSize + 1}–
				{Math.min(page * data.pageSize, data.total)} of {data.total} unresolved
				items.
			</p>
			<div className="mt-5 divide-y divide-(--border)">
				{items.map((item) => (
					<div key={item.id} className="flex gap-4 py-4">
						<div className="mt-0.5 text-(--foreground-muted)">
							{item.mediaType === "episode" ? (
								<Tv className="size-4" />
							) : (
								<Film className="size-4" />
							)}
						</div>
						<div>
							<p className="font-medium">
								{item.title ?? "Unknown title"}
								{item.year ? ` (${item.year})` : ""}
							</p>
							{item.episodeNumber !== undefined ? (
								<p className="text-(--foreground-muted) text-sm">
									S{item.seasonNumber}E{item.episodeNumber}
									{item.episodeTitle ? ` · ${item.episodeTitle}` : ""}
								</p>
							) : null}
							<p className="mt-1 text-(--foreground-muted) text-sm">
								{item.message ?? "No compatible TMDB item was available."}
							</p>
						</div>
					</div>
				))}
			</div>
			{lastPage > 1 ? (
				<div className="mt-5 flex justify-end gap-2">
					<button
						type="button"
						className="btn btn-secondary"
						disabled={page === 1}
						onClick={() => setPage((value) => value - 1)}
					>
						<ChevronLeft className="size-4" />
						Previous
					</button>
					<button
						type="button"
						className="btn btn-secondary"
						disabled={page === lastPage}
						onClick={() => setPage((value) => value + 1)}
					>
						Next
						<ChevronRight className="size-4" />
					</button>
				</div>
			) : null}
		</section>
	);
}

function Metric({
	value,
	label,
	panel = false,
}: {
	value: number;
	label: string;
	panel?: boolean;
}) {
	return (
		<div
			className={
				panel
					? "bg-(--background-elevated) p-5 text-center"
					: "rounded-xl bg-(--background-subtle) p-4"
			}
		>
			<p className="font-display font-semibold text-2xl tabular-nums">
				{value}
			</p>
			<p className="mt-1 text-(--foreground-muted) text-xs sm:text-sm">
				{label}
			</p>
		</div>
	);
}
