import {
	type SyncIssueDto,
	type SyncResolveDto,
	type SyncSettingsDto,
	type SyncStatusDto,
	TRAKT_MISSING_CONFIRMATION,
	TRAKT_PUBLICATION_COPY,
	TRAKT_SCOPE_COPY,
	TRAKT_SYNC_DIRECTIONS,
	TRAKT_SYNC_RECORDS,
	TRAKT_SYNC_SCOPES,
	TRAKT_UNCONFIRMED_CHOICE_COPY,
	traktError,
	traktIssueRecovery,
	traktRecordTitle,
	traktResolutionLabel,
	traktSettings,
	traktSyncActionLabel,
	traktSyncControllerActionMutation,
	traktSyncControllerConfigureMutation,
	traktSyncControllerConnectMutation,
	traktSyncControllerIssues,
	traktSyncControllerMatchesOptions,
	traktSyncControllerResolveMutation,
	traktSyncControllerStatus,
	traktSyncStateMessage,
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
	DialogTrigger,
} from "#/components/ui/dialog";

function displayValue(value: string) {
	return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))
		? new Date(value).toLocaleString([], {
				dateStyle: "medium",
				timeStyle: "short",
			})
		: value;
}

const rootKey = ["trakt-sync"];
const card =
	"rounded-2xl border border-(--border) bg-(--background-elevated) p-5 sm:p-7";

export function TraktSyncManager({
	connectionFailed = false,
	embedded = false,
	issuesOnly = false,
}: {
	connectionFailed?: boolean;
	embedded?: boolean;
	issuesOnly?: boolean;
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
	if (issuesOnly)
		return (
			<div className="mx-auto max-w-3xl space-y-6">
				<Link to="/trakt-sync" className="text-sm underline">
					Back to Trakt Sync
				</Link>
				<h1 className="font-display font-semibold text-3xl">
					Review sync items
				</h1>
				<SyncIssues connected={connected} />
			</div>
		);
	const needsSetup =
		connected &&
		data.status === "paused" &&
		data.direction !== "outbound" &&
		!data.publicationConsent &&
		!data.listPublicationConsent &&
		!data.contentPublicationConsent &&
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
						Keep your Watches, Ratings, Lists, Favorites, Notes, Library and
						Reviews in sync, even when the app is closed. You choose what moves
						and in which direction.
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
						Trakt Sync is not configured on this server yet.
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
									data.favorites && "Favorites",
									data.notes && "Notes",
									data.library && "Library",
									data.reviews && "Reviews",
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
								onClick={() => setEditing(true)}
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
							)
								.filter(
									(name) =>
										name !== "sync" ||
										!["running", "queued", "waiting"].includes(
											data.syncState ?? "",
										),
								)
								.map((name) => (
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
												? traktSyncActionLabel(data)
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
					<Dialog open onOpenChange={setDisconnect}>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Disconnect Trakt?</DialogTitle>
								<DialogDescription>
									Disconnecting stops sync and revokes access. Transferred
									records remain on both services. Reconnecting this account
									catches up previously linked records.
								</DialogDescription>
							</DialogHeader>
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
						</DialogContent>
					</Dialog>
				)}
				{traktSyncStateMessage(data) && (
					<output
						aria-live="polite"
						className="mt-4 block text-(--foreground-muted) text-sm"
					>
						{traktSyncStateMessage(data)}
					</output>
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
			{connected && needsSetup && !editing && (
				<SyncSettings
					key={`${data.username}:${data.direction}:${data.watches}:${data.ratings}:${data.lists}:${data.watchlist}:${data.favorites}:${data.notes}:${data.library}:${data.reviews}:${data.contentPublicationConsent}:${data.listPublicationConsent}:${data.historyScope}`}
					status={data}
					className={card}
					onSaved={() => {
						setEditing(false);
						return refresh();
					}}
					onCancel={editing ? () => setEditing(false) : undefined}
				/>
			)}
			<Dialog open={editing} onOpenChange={setEditing}>
				<DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Sync settings</DialogTitle>
						<DialogDescription>
							Choose what moves between Trakt and Opnshelf.
						</DialogDescription>
					</DialogHeader>
					{editing && (
						<SyncSettings
							status={data}
							className="space-y-5"
							showHeading={false}
							onSaved={() => {
								setEditing(false);
								return refresh();
							}}
							onCancel={() => setEditing(false)}
						/>
					)}
				</DialogContent>
			</Dialog>
			{data.username &&
				(connected || data.needsAttention > 0 || data.ignored > 0) && (
					<section className={card}>
						<h2 className="font-semibold text-lg">Needs attention</h2>
						<p className="my-3 text-(--foreground-muted) text-sm">
							{data.needsAttention}{" "}
							{data.needsAttention === 1 ? "item" : "items"} to review ·{" "}
							{data.ignored} ignored. Other records keep syncing.
						</p>
						<Link to="/trakt-sync/attention" className="btn btn-primary">
							Review items <ArrowRight className="size-4" />
						</Link>
					</section>
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
	const [choosingRecords, setChoosingRecords] = useState(false);
	const submitButton = useRef<HTMLButtonElement>(null);
	const managed =
		status.status === "active" ||
		status.status === "preparing" ||
		status.direction === "outbound" ||
		Boolean(
			status.lastSuccessAt ||
				status.publicationConsent ||
				status.listPublicationConsent ||
				status.contentPublicationConsent,
		);
	const save = useMutation({
		...traktSyncControllerConfigureMutation(),
		onSuccess: () => {
			setReviewing(false);
			onSaved();
		},
	});
	const requiresHistoryConsent =
		settings.direction !== "outbound" && (settings.watches || settings.ratings);
	const requiresListConsent = Boolean(
		settings.lists || settings.watchlist || settings.favorites,
	);
	const requiresContentConsent = Boolean(
		settings.notes || settings.library || settings.reviews,
	);
	const requiresConsent =
		requiresHistoryConsent || requiresListConsent || requiresContentConsent;
	const hasConsent = Boolean(
		(!requiresHistoryConsent || settings.publicationConsent) &&
			(!requiresListConsent || settings.listPublicationConsent) &&
			(!requiresContentConsent || settings.contentPublicationConsent),
	);
	const hadConsent = Boolean(
		(!requiresHistoryConsent || status.publicationConsent) &&
			(!requiresListConsent || status.listPublicationConsent) &&
			(!requiresContentConsent || status.contentPublicationConsent),
	);
	const canSave = hasConsent;
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
				<div className="space-y-3">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0 space-y-1">
							<p className="font-medium text-sm">Records</p>
							<p className="text-(--foreground-muted) text-sm leading-relaxed">
								{TRAKT_SYNC_RECORDS.filter(({ value }) => settings[value])
									.map(({ label }) => label)
									.join(", ") || "Choose at least one record type"}
							</p>
						</div>
						<button
							type="button"
							aria-expanded={choosingRecords}
							className="shrink-0 rounded-md py-1 font-medium text-(--accent) text-sm underline-offset-4 hover:underline focus-visible:outline-2"
							onClick={() => setChoosingRecords(true)}
						>
							Choose records
						</button>
					</div>
					<Dialog open={choosingRecords} onOpenChange={setChoosingRecords}>
						<DialogContent className="max-h-[85dvh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>Choose records</DialogTitle>
								<DialogDescription>Choose what to sync.</DialogDescription>
							</DialogHeader>
							<fieldset className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-(--border) p-3">
								<legend className="sr-only">Records</legend>
								{TRAKT_SYNC_RECORDS.map(({ value, label }) => (
									<label
										key={value}
										className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-(--background)"
									>
										<input
											type="checkbox"
											checked={settings[value] ?? false}
											onChange={(event) =>
												setSettings({
													...settings,
													[value]: event.target.checked,
												})
											}
										/>
										{label}
									</label>
								))}
							</fieldset>
							<button
								type="button"
								className="btn btn-secondary"
								onClick={() => setChoosingRecords(false)}
							>
								Done
							</button>
						</DialogContent>
					</Dialog>
				</div>
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
							!settings.watchlist &&
							!settings.favorites &&
							!settings.notes &&
							!settings.library &&
							!settings.reviews
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
									settings.favorites && "Favorites",
									settings.notes && "Notes",
									settings.library && "Library",
									settings.reviews && "Reviews",
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
											contentPublicationConsent: event.target.checked,
										})
									}
								/>
								<span>{TRAKT_PUBLICATION_COPY}</span>
							</label>
						))}

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

function SyncIssues({
	connected,
	view = "attention",
}: {
	connected: boolean;
	view?: "attention" | "ignored";
}) {
	const [ignoredOpen, setIgnoredOpen] = useState(false);
	const [page, setPage] = useState(1);
	const result = useQuery({
		queryKey: [...rootKey, "issues", view, page],
		queryFn: async ({ signal }) =>
			(
				await traktSyncControllerIssues({
					query: { view, page, pageSize: 1 },
					signal,
					throwOnError: true,
				})
			).data,
		placeholderData: keepPreviousData,
		refetchInterval: 10_000,
	});
	return (
		<Dialog open={ignoredOpen} onOpenChange={setIgnoredOpen}>
			<section className="space-y-4">
				{view === "attention" && (
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="font-display font-semibold text-2xl">
							Needs attention
						</h2>
						<DialogTrigger asChild>
							<button
								type="button"
								className="btn btn-secondary max-w-full whitespace-normal"
							>
								View ignored
							</button>
						</DialogTrigger>
					</div>
				)}
				<p className="text-(--foreground-muted) text-sm">
					{view === "ignored"
						? "Ignored items aren’t synced. Restore an item to move it back to Needs attention."
						: "Other records keep syncing while you resolve these items. Ignored items are not counted as synced."}
				</p>
				{!result.data && result.isPending && (
					<output
						aria-label="Loading sync items"
						className={`${card} block space-y-3 motion-safe:animate-pulse`}
					>
						<div className="h-5 w-40 rounded bg-(--background-subtle)" />
						<div className="h-4 w-3/4 rounded bg-(--background-subtle)" />
						<div className="grid grid-cols-2 gap-3">
							<div className="h-16 rounded-lg bg-(--background-subtle)" />
							<div className="h-16 rounded-lg bg-(--background-subtle)" />
						</div>
						<div className="h-10 rounded-lg bg-(--background-subtle)" />
						<div className="h-10 rounded-lg bg-(--background-subtle)" />
					</output>
				)}
				{result.error && <p role="alert">{traktError(result.error)}</p>}
				{result.isPlaceholderData && (
					<output className="text-(--foreground-muted) text-sm">
						Loading item {page}…
					</output>
				)}
				{result.data && result.data.total > 0 && (
					<nav
						aria-label="Sync review items"
						className="flex items-center justify-between gap-3"
					>
						<button
							type="button"
							className="btn btn-secondary"
							disabled={
								!result.data.hasPreviousPage || result.isPlaceholderData
							}
							onClick={() => setPage(result.data.page - 1)}
						>
							Previous
						</button>
						<p className="text-(--foreground-muted) text-sm" aria-live="polite">
							Item {result.data.page} of {result.data.total}
						</p>
						<button
							type="button"
							className="btn btn-secondary"
							disabled={!result.data.hasNextPage || result.isPlaceholderData}
							onClick={() => setPage(result.data.page + 1)}
						>
							Next
						</button>
					</nav>
				)}
				{result.data?.items.map((item) => (
					<div
						key={item.id}
						className="rounded-2xl border border-(--border) bg-(--background-elevated) pt-5"
					>
						<SyncIssue item={item} connected={connected} />
					</div>
				))}
				{result.data?.total === 0 && (
					<p className={`${card} text-(--foreground-muted)`}>
						{view === "ignored"
							? "No ignored items."
							: "Nothing needs your attention."}
					</p>
				)}

				{view === "attention" && (
					<DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
						<DialogHeader>
							<DialogTitle>Ignored items</DialogTitle>
							<DialogDescription>
								Items you’ve set aside from Trakt Sync.
							</DialogDescription>
						</DialogHeader>
						{ignoredOpen && <SyncIssues connected={connected} view="ignored" />}
					</DialogContent>
				)}
			</section>
		</Dialog>
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
		<article className="px-5 pb-5" aria-busy={mutation.isPending}>
			<h3 className="font-semibold text-lg">
				{traktRecordTitle(item.opnshelf) ??
					traktRecordTitle(item.trakt) ??
					"Removed record"}
			</h3>
			<p className="mt-2 text-(--foreground-muted) text-sm">
				{traktIssueRecovery(item) === "verify"
					? "Saved in Opnshelf. We couldn’t confirm whether Trakt received it. Check again, or check your Trakt account before choosing a version."
					: item.issue}
			</p>
			<dl className="my-4 grid grid-cols-2 gap-3">
				{(["opnshelf", "trakt"] as const).map((name) => (
					<div key={name} className="rounded-lg bg-(--background-subtle) p-3">
						<dt className="text-(--foreground-muted) text-xs">
							{name === "trakt" ? "Trakt" : "Opnshelf"}
						</dt>
						<dd className="mt-1 break-words text-sm">
							{(item[name]?.displayValue
								? displayValue(item[name].displayValue)
								: undefined) ??
								(name === "trakt" && traktIssueRecovery(item) === "verify"
									? "Not confirmed yet"
									: "Not present")}
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
					Restore item
				</button>
			) : (
				<div className="flex flex-wrap gap-2">
					{connected &&
						traktIssueRecovery(item) !== "retry" &&
						(["trakt", "opnshelf"] as const).map((action) => (
							<button
								key={action}
								type="button"
								className="btn btn-secondary max-w-full whitespace-normal"
								disabled={mutation.isPending}
								onClick={() =>
									setChoice({
										action,
										...(traktIssueRecovery(item) === "verify"
											? { confirmedTraktMissing: false }
											: {}),
									})
								}
							>
								{traktIssueRecovery(item) === "verify"
									? action === "opnshelf"
										? "Send after checking Trakt"
										: "Remove from Opnshelf"
									: traktResolutionLabel(action, Boolean(item[action]))}
							</button>
						))}
					{connected && (
						<button
							type="button"
							className="btn btn-secondary max-w-full whitespace-normal"
							disabled={mutation.isPending}
							onClick={() => resolve({ action: "retry" })}
						>
							{traktIssueRecovery(item) === "verify" ? "Check again" : "Retry"}
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
				item.candidates.map((candidate, index) => (
					<div key={candidate.key} className="mt-4 space-y-3">
						<div
							id={`sync-candidate-${item.id}-${index}`}
							className="space-y-1"
						>
							<p className="text-(--foreground-muted) text-xs">
								Existing {item.kind === "watch" ? "Watch" : "record"} in{" "}
								{item.opnshelf ? "Trakt" : "Opnshelf"}
							</p>
							<p className="font-semibold text-sm">
								{traktRecordTitle(candidate)}
							</p>
							<p className="text-(--foreground-muted) text-sm">
								{displayValue(candidate.displayValue)}
							</p>
						</div>
						<button
							type="button"
							className="btn btn-primary w-full"
							aria-describedby={`sync-candidate-${item.id}-${index}`}
							disabled={mutation.isPending}
							onClick={() =>
								setChoice({ action: "link", candidateKey: candidate.key })
							}
						>
							Link this {item.kind === "watch" ? "Watch" : "record"}
						</button>
					</div>
				))}
			{connected && !item.ignored && item.candidates.length > 0 && (
				<button
					type="button"
					className="btn btn-secondary mt-3"
					disabled={mutation.isPending}
					onClick={() => resolve({ action: "separate" })}
				>
					{item.kind === "watch"
						? "These are different Watches"
						: "These are separate records"}
				</button>
			)}
			{connected &&
				item.kind !== "list" &&
				item.kind !== "watchlist" &&
				item.kind !== "favorites" &&
				item.trakt?.mediaId === null &&
				item.trakt?.mediaType !== "list" && (
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
				<Dialog
					open
					onOpenChange={(open) => {
						if (!open) setChoice(null);
					}}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Confirm sync choice</DialogTitle>
							<DialogDescription>
								This choice applies to{" "}
								{traktRecordTitle(item.opnshelf) ??
									traktRecordTitle(item.trakt) ??
									"this item"}
								.
							</DialogDescription>
						</DialogHeader>
						<p>
							{choice.action === "link"
								? item.kind === "watch"
									? "Link the existing Opnshelf and Trakt Watches as one viewing. This step keeps both dates. If they differ, you’ll next choose which watch date to keep. Future changes follow your sync settings."
									: "Link these records?"
								: choice.action === "match"
									? item.kind === "watch"
										? "Use this title for this Trakt media identity and its Watch dates?"
										: "Use this title for this Trakt item?"
									: traktResolutionLabel(
											choice.action,
											Boolean(item[choice.action as "trakt" | "opnshelf"]),
										)}
						</p>
						{choice.confirmedTraktMissing !== undefined && (
							<div className="space-y-3">
								<p>{TRAKT_UNCONFIRMED_CHOICE_COPY}</p>
								<label className="flex gap-2 text-sm">
									<input
										type="checkbox"
										checked={choice.confirmedTraktMissing}
										onChange={(event) =>
											setChoice({
												...choice,
												confirmedTraktMissing: event.target.checked,
											})
										}
									/>
									{TRAKT_MISSING_CONFIRMATION}
								</label>
							</div>
						)}
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
						{mutation.error && <p role="alert">{traktError(mutation.error)}</p>}
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
								disabled={
									mutation.isPending || choice.confirmedTraktMissing === false
								}
								onClick={() => resolve(choice)}
							>
								{mutation.isPending ? "Saving…" : "Confirm choice"}
							</button>
						</div>
					</DialogContent>
				</Dialog>
			)}
			{mutation.error && (
				<p className="mt-3" role="alert">
					{traktError(mutation.error)}
				</p>
			)}
		</article>
	);
}
