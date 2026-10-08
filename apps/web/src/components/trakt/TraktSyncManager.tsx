import {
	type SyncIssueDto,
	type SyncResolveDto,
	type SyncSettingsDto,
	type SyncStatusDto,
	TRAKT_HANDOFF_COPY,
	TRAKT_PUBLICATION_COPY,
	TRAKT_SCOPE_COPY,
	TRAKT_SYNC_DIRECTIONS,
	TRAKT_SYNC_SCOPES,
	traktError,
	traktResolutionLabel,
	traktSettings,
	traktSyncControllerActionMutation,
	traktSyncControllerConfigureMutation,
	traktSyncControllerConnectMutation,
	traktSyncControllerIssues,
	traktSyncControllerMatchesOptions,
	traktSyncControllerResolveMutation,
	traktSyncControllerStatus,
} from "@opnshelf/api";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, Check, Link2 } from "lucide-react";
import { useState } from "react";

const rootKey = ["trakt-sync"];
const card =
	"rounded-2xl border border-(--border) bg-(--background-elevated) p-5 sm:p-7";

export function TraktSyncManager() {
	const queryClient = useQueryClient();
	const refresh = () => queryClient.invalidateQueries({ queryKey: rootKey });
	const status = useQuery({
		queryKey: [...rootKey, "status"],
		queryFn: async ({ signal }) =>
			(await traktSyncControllerStatus({ signal, throwOnError: true })).data,
		refetchInterval: 5000,
	});
	const connect = useMutation({
		...traktSyncControllerConnectMutation(),
		onSuccess: (data) => {
			window.location.assign(data.url);
		},
	});
	const action = useMutation({
		...traktSyncControllerActionMutation(),
		onSuccess: refresh,
	});
	const [disconnect, setDisconnect] = useState(false);
	if (!status.data)
		return status.isError ? (
			<p role="alert">
				{traktError(status.error)}{" "}
				<button
					type="button"
					className="btn btn-secondary max-w-full whitespace-normal"
					onClick={() => status.refetch()}
				>
					Retry
				</button>
			</p>
		) : (
			<output
				aria-label="Loading Trakt Sync"
				className={`${card} block h-72 animate-pulse`}
			/>
		);
	const data = status.data;
	const connected =
		data.status !== "disconnected" && data.status !== "reconnect";
	return (
		<div className="mx-auto max-w-3xl space-y-6">
			<header className="space-y-3">
				<div className="flex items-center gap-3 text-(--accent)">
					<ArrowLeftRight className="size-6" />
					<span className="font-medium text-sm">Your history, together</span>
				</div>
				<h1 className="font-display font-semibold text-3xl sm:text-4xl">
					Trakt Sync
				</h1>
				<p className="max-w-xl text-(--foreground-muted)">
					Keep your Watches and Ratings in sync, even when the app is closed.
					You choose what moves and in which direction.
				</p>
				<Link
					to="/trakt-import"
					className="inline-block text-(--accent) underline underline-offset-4"
				>
					Import once or view previous Import results
				</Link>
			</header>
			<section className={card} aria-label="Trakt connection">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="font-semibold text-lg">
							{data.username
								? `@${data.username}`
								: "Connect your Trakt account"}
						</h2>
						<p className="mt-1 text-(--foreground-muted) text-sm">
							{data.status === "preparing"
								? "Comparing your history. You can leave this screen."
								: data.status === "active"
									? "Sync is on"
									: data.status === "paused"
										? "Sync is paused"
										: data.status === "reconnect"
											? "Reconnect to continue"
											: "No account connected"}
						</p>
					</div>
					<Link2 className="size-5 text-(--foreground-muted)" />
				</div>
				{!data.configured ? (
					<p className="mt-4 text-(--foreground-muted)">
						Trakt Sync is not configured on this server yet. Import once is
						still available.
					</p>
				) : !connected ? (
					<button
						className="btn btn-primary mt-5"
						type="button"
						disabled={connect.isPending}
						onClick={() => connect.mutate({ body: { platform: "web" } })}
					>
						{connect.isPending
							? "Opening Trakt…"
							: data.status === "reconnect"
								? "Reconnect Trakt"
								: "Connect Trakt"}
					</button>
				) : (
					<>
						<p className="mt-4 text-(--foreground-muted) text-sm">
							{data.lastSuccessAt
								? `Last successful check: ${new Date(data.lastSuccessAt).toLocaleString()}`
								: "No successful sync yet."}{" "}
							Trakt is checked about every 15 minutes; rate limits can delay
							transfers.
						</p>
						<div className="mt-4 flex flex-wrap gap-2">
							{(
								[
									"sync",
									["active", "preparing"].includes(data.status)
										? "pause"
										: "resume",
								] as const
							).map((name) => (
								<button
									key={name}
									type="button"
									className="btn btn-secondary max-w-full whitespace-normal"
									disabled={
										action.isPending && action.variables?.body.action === name
									}
									onClick={() => action.mutate({ body: { action: name } })}
								>
									{action.isPending && action.variables?.body.action === name
										? "Saving…"
										: name === "sync"
											? "Sync now"
											: name === "pause"
												? "Pause"
												: "Resume"}
								</button>
							))}
							<button
								type="button"
								className="btn btn-secondary max-w-full whitespace-normal"
								onClick={() => setDisconnect(true)}
							>
								Disconnect
							</button>
						</div>
					</>
				)}
				{disconnect && (
					<div className="mt-4 space-y-3 rounded-xl border border-(--border) p-4">
						<p>
							Disconnecting stops sync and revokes access. Transferred records
							remain on both services. Reconnecting this account catches up
							previously linked records.
						</p>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								className="btn btn-secondary max-w-full whitespace-normal"
								onClick={() => setDisconnect(false)}
							>
								Cancel
							</button>
							<button
								type="button"
								className="btn btn-primary max-w-full whitespace-normal"
								disabled={action.isPending}
								onClick={() =>
									action.mutate(
										{ body: { action: "disconnect" } },
										{ onSuccess: () => setDisconnect(false) },
									)
								}
							>
								Confirm disconnect
							</button>
						</div>
					</div>
				)}
				{(connect.error || action.error || data.lastError) && (
					<p role="alert" className="mt-4 text-(--destructive)">
						{connect.error
							? traktError(connect.error)
							: action.error
								? traktError(action.error)
								: data.lastError}
					</p>
				)}
			</section>
			{connected && (
				<SyncSettings
					key={`${data.username}:${data.direction}:${data.watches}:${data.ratings}:${data.historyScope}`}
					status={data}
					onSaved={refresh}
				/>
			)}
			{data.username && <SyncIssues connected={connected} />}
		</div>
	);
}

function SyncSettings({
	status,
	onSaved,
}: {
	status: SyncStatusDto;
	onSaved: () => unknown;
}) {
	const [settings, setSettings] = useState<SyncSettingsDto>(() =>
		traktSettings(status),
	);
	const [reviewing, setReviewing] = useState(false);
	const save = useMutation({
		...traktSyncControllerConfigureMutation(),
		onSuccess: () => {
			setReviewing(false);
			onSaved();
		},
	});
	const unfinished =
		status.importStatus &&
		!["completed", "continued_in_sync"].includes(status.importStatus);
	return (
		<section className={card}>
			<h2 className="font-semibold text-xl">What to keep in sync</h2>
			<form
				className="mt-5 space-y-5"
				onSubmit={(e) => {
					e.preventDefault();
					setReviewing(true);
				}}
			>
				<fieldset className="flex flex-wrap gap-5">
					<legend className="mb-2 text-(--foreground-muted) text-sm">
						Choose your records
					</legend>
					{(["watches", "ratings"] as const).map((name) => (
						<label key={name} className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={settings[name]}
								onChange={(e) =>
									setSettings({ ...settings, [name]: e.target.checked })
								}
							/>
							{name === "watches" ? "Watch history" : "Ratings"}
						</label>
					))}
				</fieldset>
				<fieldset className="space-y-2">
					<legend className="mb-2 font-medium">Direction</legend>
					{TRAKT_SYNC_DIRECTIONS.map((choice) => (
						<label
							key={choice.value}
							className="flex items-center gap-3 rounded-xl border border-(--border) p-3"
						>
							<input
								type="radio"
								name="direction"
								checked={settings.direction === choice.value}
								onChange={() =>
									setSettings({ ...settings, direction: choice.value })
								}
							/>
							{choice.label}
						</label>
					))}
				</fieldset>
				<fieldset className="space-y-2">
					<legend className="mb-2 font-medium">Include unlinked records</legend>
					{TRAKT_SYNC_SCOPES.map((choice) => (
						<label key={choice.value} className="flex items-center gap-3">
							<input
								type="radio"
								name="scope"
								checked={settings.historyScope === choice.value}
								onChange={() =>
									setSettings({ ...settings, historyScope: choice.value })
								}
							/>
							{choice.label}
						</label>
					))}
					<p className="text-(--foreground-muted) text-sm">
						{TRAKT_SCOPE_COPY}
					</p>
				</fieldset>
				{settings.direction !== "outbound" && (
					<label className="flex items-start gap-3 rounded-xl bg-(--background-subtle) p-4">
						<input
							className="mt-1"
							type="checkbox"
							checked={settings.publicationConsent}
							onChange={(e) =>
								setSettings({
									...settings,
									publicationConsent: e.target.checked,
								})
							}
						/>
						<span className="text-sm">{TRAKT_PUBLICATION_COPY}</span>
					</label>
				)}
				{unfinished && (
					<div className="space-y-2 rounded-xl border border-(--border) p-4">
						<label className="flex items-start gap-3">
							<input
								className="mt-1"
								type="checkbox"
								checked={settings.handoffImport ?? false}
								onChange={(e) =>
									setSettings({ ...settings, handoffImport: e.target.checked })
								}
							/>
							<span className="text-sm">{TRAKT_HANDOFF_COPY}</span>
						</label>
						<Link to="/trakt-import" className="text-(--accent) underline">
							Finish Import first
						</Link>
					</div>
				)}
				{!reviewing ? (
					<button
						type="submit"
						className="btn btn-primary max-w-full whitespace-normal"
						disabled={
							(!settings.watches && !settings.ratings) ||
							(settings.direction !== "outbound" &&
								!settings.publicationConsent) ||
							Boolean(unfinished && !settings.handoffImport)
						}
					>
						Review sync settings
					</button>
				) : (
					<div className="space-y-3 rounded-xl border border-(--accent) p-4">
						<h3 className="font-semibold">Confirm these transfers</h3>
						<p>
							{[
								settings.watches && "Watch history",
								settings.ratings && "Ratings",
							]
								.filter(Boolean)
								.join(" and ")}{" "}
							·{" "}
							{
								TRAKT_SYNC_DIRECTIONS.find(
									(d) => d.value === settings.direction,
								)?.label
							}{" "}
							·{" "}
							{
								TRAKT_SYNC_SCOPES.find((s) => s.value === settings.historyScope)
									?.label
							}
						</p>
						<p className="text-(--foreground-muted) text-sm">
							Edits and deletions propagate for linked records. Disabling a type
							preserves records. Conflicts that need your choice appear below.
						</p>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								className="btn btn-secondary max-w-full whitespace-normal"
								onClick={() => setReviewing(false)}
							>
								Back
							</button>
							<button
								type="button"
								className="btn btn-primary max-w-full whitespace-normal"
								disabled={save.isPending}
								onClick={() => save.mutate({ body: settings })}
							>
								{save.isPending ? "Preparing sync…" : "Confirm and enable sync"}
							</button>
						</div>
					</div>
				)}
				{save.error && <p role="alert">{traktError(save.error)}</p>}
				{save.isSuccess && (
					<p className="flex items-center gap-2">
						<Check className="size-4" />
						Settings saved
					</p>
				)}
			</form>
		</section>
	);
}

function SyncIssues({ connected }: { connected: boolean }) {
	const [view, setView] = useState<"attention" | "ignored">("attention");
	const [page, setPage] = useState(1);
	const result = useQuery({
		queryKey: [...rootKey, "issues", view, page],
		queryFn: async ({ signal }) =>
			(
				await traktSyncControllerIssues({
					query: { view, page },
					signal,
					throwOnError: true,
				})
			).data,
		placeholderData: keepPreviousData,
		refetchInterval: 10_000,
	});
	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-display font-semibold text-2xl">
					{view === "attention" ? "Needs attention" : "Ignored"}
				</h2>
				<button
					type="button"
					className="btn btn-secondary max-w-full whitespace-normal"
					onClick={() => {
						setPage(1);
						setView(view === "attention" ? "ignored" : "attention");
					}}
				>
					{view === "attention" ? "View ignored" : "Needs attention"}
				</button>
			</div>
			<p className="text-(--foreground-muted) text-sm">
				Other records keep syncing while you resolve these items. Ignored items
				are not counted as synced.
			</p>
			{!result.data && result.isPending && (
				<div className={`${card} h-40 animate-pulse`} />
			)}
			{result.error && <p role="alert">{traktError(result.error)}</p>}
			{result.data?.items.map((item) => (
				<SyncIssue key={item.id} item={item} connected={connected} />
			))}
			{result.data?.total === 0 && (
				<p className={`${card} text-(--foreground-muted)`}>
					{view === "ignored"
						? "No ignored items."
						: "Nothing needs your attention."}
				</p>
			)}
			{result.data && result.data.totalPages > 1 && (
				<nav
					aria-label="Sync issues pages"
					className="flex items-center justify-between"
				>
					<button
						className="btn btn-secondary max-w-full whitespace-normal"
						type="button"
						disabled={!result.data.hasPreviousPage || result.isPlaceholderData}
						onClick={() => setPage(page - 1)}
					>
						Previous
					</button>
					<span>
						Page {result.data.page} of {result.data.totalPages}
					</span>
					<button
						className="btn btn-secondary max-w-full whitespace-normal"
						type="button"
						disabled={!result.data.hasNextPage || result.isPlaceholderData}
						onClick={() => setPage(page + 1)}
					>
						Next
					</button>
				</nav>
			)}
		</section>
	);
}

function SyncIssue({
	item,
	connected,
}: {
	item: SyncIssueDto;
	connected: boolean;
}) {
	const client = useQueryClient();
	const [choice, setChoice] = useState<SyncResolveDto | null>(null);
	const [search, setSearch] = useState("");
	const [query, setQuery] = useState<string | null>(null);
	const mutation = useMutation({
		...traktSyncControllerResolveMutation(),
		onSuccess: () => {
			setChoice(null);
			void client.invalidateQueries({ queryKey: rootKey });
		},
	});
	const matches = useQuery({
		...traktSyncControllerMatchesOptions({
			path: { id: item.id },
			query: { q: query ?? "" },
		}),
		enabled: query !== null,
	});
	const resolve = (body: SyncResolveDto) =>
		mutation.mutate({ path: { id: item.id }, body });
	return (
		<article className={card} aria-busy={mutation.isPending}>
			<h3 className="font-semibold text-lg">
				{item.opnshelf?.title ?? item.trakt?.title ?? "Removed record"}
			</h3>
			<p className="mt-2 text-(--foreground-muted) text-sm">{item.issue}</p>
			<dl className="my-4 grid grid-cols-2 gap-3">
				{(["opnshelf", "trakt"] as const).map((name) => (
					<div key={name} className="rounded-lg bg-(--background-subtle) p-3">
						<dt className="text-(--foreground-muted) text-xs">
							{name === "trakt" ? "Trakt" : "Opnshelf"}
						</dt>
						<dd className="mt-1 break-words text-sm">
							{item[name]?.displayValue ?? "Not present"}
						</dd>
					</div>
				))}
			</dl>
			{item.ignored ? (
				<button
					type="button"
					className="btn btn-secondary max-w-full whitespace-normal"
					disabled={mutation.isPending}
					onClick={() => resolve({ action: "undo" })}
				>
					Undo ignore
				</button>
			) : (
				<div className="flex flex-wrap gap-2">
					{connected &&
						((item.opnshelf && item.trakt) ||
							item.issue.includes("changed") ||
							item.issue.includes("version")) &&
						(["trakt", "opnshelf"] as const).map((action) => (
							<button
								key={action}
								type="button"
								className="btn btn-secondary max-w-full whitespace-normal"
								disabled={mutation.isPending}
								onClick={() => setChoice({ action })}
							>
								{traktResolutionLabel(action, Boolean(item[action]))}
							</button>
						))}
					{connected && (
						<button
							type="button"
							className="btn btn-secondary max-w-full whitespace-normal"
							disabled={mutation.isPending}
							onClick={() => resolve({ action: "retry" })}
						>
							Retry
						</button>
					)}
					<button
						type="button"
						className="btn btn-secondary max-w-full whitespace-normal"
						disabled={mutation.isPending}
						onClick={() => resolve({ action: "ignore" })}
					>
						Ignore this item
					</button>
				</div>
			)}
			{connected &&
				!item.ignored &&
				item.candidates.map((candidate) => (
					<button
						type="button"
						key={candidate.key}
						className="mt-3 block w-full rounded-xl border border-(--border) p-3 text-left text-sm"
						disabled={mutation.isPending}
						onClick={() =>
							setChoice({ action: "link", candidateKey: candidate.key })
						}
					>
						Same viewing as {candidate.title} · {candidate.displayValue}
					</button>
				))}
			{connected && !item.ignored && item.candidates.length > 0 && (
				<button
					type="button"
					className="btn btn-secondary mt-3"
					disabled={mutation.isPending}
					onClick={() => resolve({ action: "separate" })}
				>
					These are different Watches
				</button>
			)}
			{connected && item.trakt?.mediaId === null && (
				<form
					className="mt-4 space-y-2"
					onSubmit={(e) => {
						e.preventDefault();
						setQuery(search);
					}}
				>
					<label className="block text-sm" htmlFor={`match-${item.id}`}>
						Find the matching title
					</label>
					<div className="flex flex-wrap gap-2">
						<input
							id={`match-${item.id}`}
							className="input min-w-0 flex-1"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={item.trakt.title}
						/>
						<button
							type="submit"
							className="btn btn-secondary max-w-full whitespace-normal"
						>
							Search
						</button>
					</div>
					{matches.isFetching && (
						<div className="h-14 animate-pulse rounded-xl bg-(--background-subtle)" />
					)}
					{matches.error && <p role="alert">{traktError(matches.error)}</p>}
					{matches.data?.map((m) => (
						<button
							type="button"
							key={m.tmdbId}
							className="block w-full rounded-lg border border-(--border) p-3 text-left"
							onClick={() => setChoice({ action: "match", mediaId: m.tmdbId })}
						>
							{m.title}
							{m.year ? ` (${m.year})` : ""}
						</button>
					))}
				</form>
			)}
			{choice && (
				<div className="mt-4 space-y-3 rounded-xl border border-(--accent) p-4">
					<p>
						{choice.action === "link"
							? "Confirm these represent the same viewing?"
							: choice.action === "match"
								? "Use this title for this Trakt media identity and its Watch dates?"
								: traktResolutionLabel(
										choice.action,
										Boolean(item[choice.action as "trakt" | "opnshelf"]),
									)}
					</p>
					{item.kind === "rating" && (
						<label className="flex gap-2 text-sm">
							<input
								type="checkbox"
								checked={choice.allRatings ?? false}
								onChange={(e) =>
									setChoice({ ...choice, allRatings: e.target.checked })
								}
							/>
							Apply to all Rating conflicts
						</label>
					)}
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className="btn btn-secondary max-w-full whitespace-normal"
							onClick={() => setChoice(null)}
						>
							Cancel
						</button>
						<button
							type="button"
							className="btn btn-primary max-w-full whitespace-normal"
							disabled={mutation.isPending}
							onClick={() => resolve(choice)}
						>
							{mutation.isPending ? "Saving…" : "Confirm choice"}
						</button>
					</div>
				</div>
			)}
			{mutation.error && (
				<p className="mt-3" role="alert">
					{traktError(mutation.error)}
				</p>
			)}
		</article>
	);
}
