import {
	type SyncIssueDto,
	type SyncResolveDto,
	type SyncSettingsDto,
	type SyncStatusDto,
	TRAKT_HANDOFF_COPY,
	TRAKT_LIST_COPY,
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
import {
	ArrowLeft,
	ArrowLeftRight,
	ArrowRight,
	Check,
	ChevronLeft,
	Link2,
	Settings2,
} from "lucide-react";
import { useRef, useState } from "react";
import { TraktMark } from "#/components/TraktMark";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

const rootKey = ["trakt-sync"];
const card =
	"rounded-2xl border border-(--border) bg-(--background-elevated) p-5 sm:p-7";

export function TraktSyncManager({
	connectionFailed = false,
	embedded = false,
}: {
	connectionFailed?: boolean;
	embedded?: boolean;
}) {
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
	const [editing, setEditing] = useState(false);
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
				className={`${embedded ? "" : card} block animate-pulse space-y-4`}
			>
				<span className="block h-5 w-36 rounded bg-(--background-subtle)" />
				<span className="block h-4 w-24 rounded bg-(--background-subtle)" />
				<span className="block h-8 w-64 max-w-full rounded bg-(--background-subtle)" />
				<span className="block h-4 w-full rounded bg-(--background-subtle)" />
				<span className="block h-10 w-80 max-w-full rounded bg-(--background-subtle)" />
			</output>
		);
	const data = status.data;
	const connected =
		data.status !== "disconnected" && data.status !== "reconnect";
	const needsSetup =
		connected &&
		data.status === "paused" &&
		data.direction !== "outbound" &&
		!data.publicationConsent &&
		!data.listPublicationConsent &&
		!data.lastSuccessAt;
	return (
		<div className={embedded ? "space-y-5" : "mx-auto max-w-3xl space-y-6"}>
			{!embedded && (
				<header className="space-y-3">
					<Link
						to="/settings/$section"
						params={{ section: "connections" }}
						className="inline-flex items-center gap-1 text-(--foreground-muted) text-sm hover:text-(--foreground)"
					>
						<ChevronLeft className="size-4" />
						Back to Settings
					</Link>
					<h1 className="font-display font-semibold text-3xl sm:text-4xl">
						Trakt Sync
					</h1>
					<p className="max-w-xl text-(--foreground-muted)">
						Keep your Watches, Ratings, Lists and watchlist in sync, even when
						the app is closed. You choose what moves and in which direction.
					</p>
				</header>
			)}
			<section className={embedded ? "" : card} aria-label="Trakt connection">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="font-semibold text-lg">
							{data.username
								? `@${data.username}`
								: "Connect your Trakt account"}
						</h2>
						<p className="mt-1 text-(--foreground-muted) text-sm">
							{needsSetup
								? "Connected. Sync is not enabled yet."
								: data.status === "preparing"
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
				) : !needsSetup ? (
					<>
						<div className="mt-4 flex flex-wrap gap-2 text-sm">
							<span className="rounded-lg bg-(--background-subtle) px-3 py-1.5 font-medium">
								{
									TRAKT_SYNC_DIRECTIONS.find(
										(choice) => choice.value === data.direction,
									)?.label
								}
							</span>
							<span className="rounded-lg bg-(--background-subtle) px-3 py-1.5">
								{[
									data.watches && "Watch history",
									data.ratings && "Ratings",
									data.lists && "Custom Lists",
									data.watchlist && "Watchlist",
								]
									.filter(Boolean)
									.join(", ")}
							</span>
						</div>
						<p className="mt-4 text-(--foreground-muted) text-sm">
							{data.lastSuccessAt
								? `Last successful check: ${new Date(data.lastSuccessAt).toLocaleString()}`
								: "No successful sync yet."}{" "}
							Trakt is checked about every 15 minutes; rate limits can delay
							transfers.
						</p>
						<div className="mt-4 flex flex-wrap gap-2">
							<button
								type="button"
								className="btn btn-secondary"
								onClick={() => setEditing(!editing)}
								aria-expanded={editing}
							>
								<Settings2 className="size-4" />
								Sync settings
							</button>
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
				) : (
					<button
						type="button"
						className="btn btn-secondary mt-4"
						onClick={() => setDisconnect(true)}
					>
						Disconnect
					</button>
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
				{(connectionFailed ||
					connect.error ||
					action.error ||
					data.lastError) && (
					<p role="alert" className="mt-4 text-(--destructive)">
						{connectionFailed
							? "Trakt could not connect. Try connecting again."
							: connect.error
								? traktError(connect.error)
								: action.error
									? traktError(action.error)
									: data.lastError}
					</p>
				)}
			</section>
			{connected && (editing || needsSetup) && (
				<SyncSettings
					key={`${data.username}:${data.direction}:${data.watches}:${data.ratings}:${data.lists}:${data.watchlist}:${data.listPublicationConsent}:${data.historyScope}`}
					status={data}
					className={embedded ? "border-(--border) border-t pt-5" : card}
					onSaved={() => {
						setEditing(false);
						return refresh();
					}}
					onCancel={editing ? () => setEditing(false) : undefined}
				/>
			)}
			{embedded && (data.status === "disconnected" || data.importStatus) && (
				<Link
					to="/trakt-import"
					className="inline-block text-(--foreground-muted) text-sm underline underline-offset-4"
				>
					{data.importStatus
						? "View previous Import results"
						: "Import public history once instead"}
				</Link>
			)}
			{data.username &&
				(!embedded || data.needsAttention > 0 || data.ignored > 0) && (
					<SyncIssues connected={connected} />
				)}
		</div>
	);
}

export function SyncSettings({
	status,
	onSaved,
	className = card,
	showHeading = true,
	onboarding = false,
	onCancel,
}: {
	status: SyncStatusDto;
	onSaved: () => unknown;
	className?: string;
	showHeading?: boolean;
	onboarding?: boolean;
	onCancel?: () => void;
}) {
	const [settings, setSettings] = useState<SyncSettingsDto>(() =>
		traktSettings(status),
	);
	const [reviewing, setReviewing] = useState(false);
	const submitButton = useRef<HTMLButtonElement>(null);
	const managed =
		status.status === "active" ||
		status.status === "preparing" ||
		status.direction === "outbound" ||
		Boolean(
			status.lastSuccessAt ||
				status.publicationConsent ||
				status.listPublicationConsent,
		);
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
	const requiresHistoryConsent =
		settings.direction !== "outbound" && (settings.watches || settings.ratings);
	const requiresListConsent = Boolean(settings.lists || settings.watchlist);
	const requiresConsent = requiresHistoryConsent || requiresListConsent;
	const hasConsent = Boolean(
		(!requiresHistoryConsent || settings.publicationConsent) &&
			(!requiresListConsent || settings.listPublicationConsent),
	);
	const hadConsent = Boolean(
		(!requiresHistoryConsent || status.publicationConsent) &&
			(!requiresListConsent || status.listPublicationConsent),
	);
	const canSave = hasConsent && (!unfinished || settings.handoffImport);
	return (
		<section className={className}>
			{showHeading && <h2 className="font-semibold text-lg">Sync settings</h2>}
			<form
				className="mt-4 space-y-5"
				onSubmit={(event) => {
					event.preventDefault();
					setReviewing(true);
				}}
			>
				<fieldset className="flex flex-wrap gap-5">
					<legend className="mb-2 font-medium text-sm">Records</legend>
					{(["watches", "ratings", "lists", "watchlist"] as const).map(
						(name) => (
							<label key={name} className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={settings[name] ?? false}
									onChange={(event) =>
										setSettings({ ...settings, [name]: event.target.checked })
									}
								/>
								{name === "watches"
									? "Watch history"
									: name === "ratings"
										? "Ratings"
										: name === "lists"
											? "Custom Lists"
											: "Watchlist"}
							</label>
						),
					)}
				</fieldset>
				{requiresListConsent && (
					<p className="text-(--foreground-muted) text-sm">{TRAKT_LIST_COPY}</p>
				)}
				<fieldset>
					<legend className="mb-2 font-medium text-sm">Direction</legend>
					<div className="grid grid-cols-3 gap-2 sm:gap-3">
						{TRAKT_SYNC_DIRECTIONS.map((choice) => {
							const Arrow =
								choice.value === "inbound"
									? ArrowRight
									: choice.value === "outbound"
										? ArrowLeft
										: ArrowLeftRight;
							return (
								<label key={choice.value} className="relative cursor-pointer">
									<input
										type="radio"
										name="direction"
										aria-label={choice.label}
										className="peer sr-only"
										checked={settings.direction === choice.value}
										onChange={() =>
											setSettings({ ...settings, direction: choice.value })
										}
									/>
									<span className="flex h-full flex-col items-center gap-2 rounded-xl border border-(--border) px-2 py-4 text-center transition-colors peer-checked:border-(--accent) peer-checked:bg-(--accent)/10 peer-focus-visible:ring-(--accent) peer-focus-visible:ring-2">
										<span
											aria-hidden="true"
											className="flex items-center gap-2"
										>
											<TraktMark className="size-5" />
											<Arrow className="size-4 text-(--foreground-muted)" />
											<img
												src="/icon.png"
												alt=""
												className="size-5 rounded-md"
											/>
										</span>
										<span className="font-semibold text-sm">
											{choice.title}
										</span>
										<span className="max-w-32 text-(--foreground-muted) text-xs leading-relaxed">
											{choice.description}
										</span>
									</span>
								</label>
							);
						})}
					</div>
				</fieldset>
				<fieldset className="space-y-2">
					<legend className="mb-2 font-medium text-sm">History</legend>
					{TRAKT_SYNC_SCOPES.map((choice) => (
						<label
							key={choice.value}
							className="flex items-center gap-3 text-sm"
						>
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
					<p className="text-(--foreground-muted) text-xs leading-relaxed">
						{TRAKT_SCOPE_COPY}
					</p>
				</fieldset>
				<div className="flex flex-wrap gap-2">
					<button
						ref={submitButton}
						type="submit"
						className="btn btn-primary"
						disabled={
							!settings.watches &&
							!settings.ratings &&
							!settings.lists &&
							!settings.watchlist
						}
					>
						{onboarding ? "Continue" : managed ? "Save changes" : "Enable sync"}
					</button>
					{onCancel && (
						<button
							type="button"
							className="btn btn-secondary"
							onClick={onCancel}
						>
							Cancel
						</button>
					)}
				</div>
				{save.isSuccess && (
					<output className="flex items-center gap-2 text-sm">
						<Check className="size-4" />
						Settings saved
					</output>
				)}
			</form>
			<Dialog
				open={reviewing}
				onOpenChange={(open) => {
					if (!save.isPending) setReviewing(open);
				}}
			>
				<DialogContent
					className="max-h-[85dvh] overflow-y-auto"
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						submitButton.current?.focus();
					}}
				>
					<DialogHeader>
						<DialogTitle>
							{managed ? "Update Trakt Sync" : "Enable Trakt Sync"}
						</DialogTitle>
						<DialogDescription>
							Confirm what will move between your accounts.
						</DialogDescription>
					</DialogHeader>
					<dl className="space-y-3 rounded-xl bg-(--background-subtle) p-4 text-sm">
						{[
							[
								"Records",
								[
									settings.watches && "Watch history",
									settings.ratings && "Ratings",
									settings.lists && "Custom Lists",
									settings.watchlist && "Watchlist",
								]
									.filter(Boolean)
									.join(", "),
							],
							[
								"Direction",
								TRAKT_SYNC_DIRECTIONS.find(
									(choice) => choice.value === settings.direction,
								)?.label,
							],
							[
								"History",
								TRAKT_SYNC_SCOPES.find(
									(choice) => choice.value === settings.historyScope,
								)?.label,
							],
						].map(([label, value]) => (
							<div key={label}>
								<dt className="text-(--foreground-muted) text-xs">{label}</dt>
								<dd className="mt-1 font-medium">{value}</dd>
							</div>
						))}
					</dl>
					<p className="text-(--foreground-muted) text-sm">
						Edits and deletions propagate for linked records. Disabling a type
						preserves records. Conflicts that need your choice appear in
						Settings.
					</p>
					{requiresConsent &&
						(hadConsent ? (
							<p className="text-(--foreground-muted) text-sm">
								{TRAKT_PUBLICATION_COPY}
							</p>
						) : (
							<label className="flex items-start gap-3 rounded-xl border border-(--border) p-4 text-sm">
								<input
									className="mt-1"
									type="checkbox"
									checked={hasConsent}
									onChange={(event) =>
										setSettings({
											...settings,
											publicationConsent: event.target.checked,
											listPublicationConsent: event.target.checked,
										})
									}
								/>
								<span>{TRAKT_PUBLICATION_COPY}</span>
							</label>
						))}
					{unfinished && (
						<div className="space-y-2 rounded-xl border border-(--border) p-4">
							<label className="flex items-start gap-3 text-sm">
								<input
									className="mt-1"
									type="checkbox"
									checked={settings.handoffImport ?? false}
									onChange={(event) =>
										setSettings({
											...settings,
											handoffImport: event.target.checked,
										})
									}
								/>
								<span>{TRAKT_HANDOFF_COPY}</span>
							</label>
							<Link
								to="/trakt-import"
								className="text-(--accent) text-sm underline"
							>
								Finish Import first
							</Link>
						</div>
					)}
					{save.error && (
						<p role="alert" className="text-(--destructive) text-sm">
							{traktError(save.error)}
						</p>
					)}
					<div className="flex flex-wrap justify-end gap-2">
						<button
							type="button"
							className="btn btn-secondary"
							disabled={save.isPending}
							onClick={() => setReviewing(false)}
						>
							Back
						</button>
						<button
							type="button"
							className="btn btn-primary disabled:opacity-50"
							disabled={save.isPending || !canSave}
							onClick={() => save.mutate({ body: settings })}
						>
							{save.isPending
								? "Saving…"
								: onboarding
									? "Enable sync and continue"
									: managed
										? status.status === "paused"
											? "Save and resume sync"
											: "Confirm changes"
										: "Confirm and enable sync"}
						</button>
					</div>
				</DialogContent>
			</Dialog>
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
			{connected &&
				item.kind !== "list" &&
				item.kind !== "watchlist" &&
				item.trakt?.mediaId === null && (
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
								onClick={() =>
									setChoice({ action: "match", mediaId: m.tmdbId })
								}
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
