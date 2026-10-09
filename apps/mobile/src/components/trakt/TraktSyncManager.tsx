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
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { useEndReached } from "@/lib/use-end-reached";

const rootKey = ["trakt-sync"];
const card = "gap-4 rounded-2xl border border-border bg-card p-4";
const copy = "text-sm leading-5 text-muted-foreground";

function Action({
	label,
	onPress,
	disabled = false,
	primary = false,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	primary?: boolean;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			className={`min-h-11 justify-center rounded-xl border px-4 py-3 ${primary ? "border-primary bg-primary" : "border-border bg-background-subtle"} ${disabled ? "opacity-50" : ""}`}
		>
			<Text
				className={`text-center font-medium ${primary ? "text-primary-foreground" : "text-foreground"}`}
			>
				{label}
			</Text>
		</Pressable>
	);
}
function Toggle({
	label,
	value,
	onChange,
}: {
	label: string;
	value: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<View className="flex-row items-center gap-3">
			<Text className="flex-1 text-foreground text-sm leading-5">{label}</Text>
			<Switch
				accessibilityLabel={label}
				value={value}
				onValueChange={onChange}
			/>
		</View>
	);
}

export function TraktSyncManager({
	connectionFailed = false,
}: {
	connectionFailed?: boolean;
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
		onSuccess: async (data) => {
			const result = await WebBrowser.openAuthSessionAsync(
				data.url,
				"opnshelf://trakt-sync",
			);
			if (
				result.type === "success" &&
				new URL(result.url).searchParams.get("connection") === "failed"
			)
				throw new Error("Trakt could not connect. Try connecting again.");
			await refresh();
		},
	});
	const action = useMutation({
		...traktSyncControllerActionMutation(),
		onSuccess: refresh,
	});
	const [disconnect, setDisconnect] = useState(false);
	if (!status.data)
		return status.isError ? (
			<View className={card}>
				<Text selectable accessibilityRole="alert" className={copy}>
					{traktError(status.error)}
				</Text>
				<Action label="Retry" onPress={() => void status.refetch()} />
			</View>
		) : (
			<View
				accessibilityLabel="Loading Trakt Sync"
				className={`${card} h-72 animate-pulse`}
			/>
		);
	const data = status.data;
	const connected =
		data.status !== "disconnected" && data.status !== "reconnect";
	return (
		<View className="gap-5">
			<View className="gap-3">
				<Text className={copy}>
					Keep your Watches and Ratings in sync, even when the app is closed.
					You choose what moves and in which direction.
				</Text>
				<Link href="/trakt-import" className="text-primary underline">
					Import once or view previous Import results
				</Link>
			</View>
			<View className={card}>
				<Text selectable className="font-semibold text-foreground text-lg">
					{data.username ? `@${data.username}` : "Connect your Trakt account"}
				</Text>
				<Text className={copy}>
					{data.status === "preparing"
						? "Comparing your history. You can leave this screen."
						: data.status === "active"
							? "Sync is on"
							: data.status === "paused"
								? "Sync is paused"
								: data.status === "reconnect"
									? "Reconnect to continue"
									: "No account connected"}
				</Text>
				{!data.configured ? (
					<Text className={copy}>
						Trakt Sync is not configured on this server yet. Import once is
						still available.
					</Text>
				) : !connected ? (
					<Action
						primary
						label={
							connect.isPending
								? "Opening Trakt…"
								: data.status === "reconnect"
									? "Reconnect Trakt"
									: "Connect Trakt"
						}
						disabled={connect.isPending}
						onPress={() => connect.mutate({ body: { platform: "mobile" } })}
					/>
				) : (
					<>
						<Text selectable className={copy}>
							{data.lastSuccessAt
								? `Last successful check: ${new Date(data.lastSuccessAt).toLocaleString()}`
								: "No successful sync yet."}{" "}
							Trakt is checked about every 15 minutes; rate limits can delay
							transfers.
						</Text>
						<View className="flex-row flex-wrap gap-2">
							{(
								[
									"sync",
									["active", "preparing"].includes(data.status)
										? "pause"
										: "resume",
								] as const
							).map((name) => (
								<Action
									key={name}
									disabled={
										action.isPending && action.variables?.body.action === name
									}
									label={
										action.isPending && action.variables?.body.action === name
											? "Saving…"
											: name === "sync"
												? "Sync now"
												: name === "pause"
													? "Pause"
													: "Resume"
									}
									onPress={() => action.mutate({ body: { action: name } })}
								/>
							))}
							<Action label="Disconnect" onPress={() => setDisconnect(true)} />
						</View>
					</>
				)}
				{disconnect && (
					<View className="gap-3 rounded-xl border border-border p-3">
						<Text className={copy}>
							Disconnecting stops sync and revokes access. Transferred records
							remain on both services. Reconnecting this account catches up
							previously linked records.
						</Text>
						<Action label="Cancel" onPress={() => setDisconnect(false)} />
						<Action
							primary
							label="Confirm disconnect"
							disabled={action.isPending}
							onPress={() =>
								action.mutate(
									{ body: { action: "disconnect" } },
									{ onSuccess: () => setDisconnect(false) },
								)
							}
						/>
					</View>
				)}
				{(connectionFailed ||
					connect.error ||
					action.error ||
					data.lastError) && (
					<Text
						selectable
						accessibilityRole="alert"
						className="text-destructive text-sm"
					>
						{connectionFailed
							? "Trakt could not connect. Try connecting again."
							: connect.error
								? traktError(connect.error)
								: action.error
									? traktError(action.error)
									: data.lastError}
					</Text>
				)}
			</View>
			{connected && (
				<SyncSettings
					key={`${data.username}:${data.direction}:${data.watches}:${data.ratings}:${data.historyScope}`}
					status={data}
					onSaved={refresh}
				/>
			)}
			{data.username && <SyncIssues connected={connected} />}
		</View>
	);
}

export function SyncSettings({
	status,
	onSaved,
	className = card,
	showHeading = true,
}: {
	status: SyncStatusDto;
	onSaved: () => unknown;
	className?: string;
	showHeading?: boolean;
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
		<View className={className}>
			{showHeading ? (
				<Text className="font-semibold text-foreground text-xl">
					What to keep in sync
				</Text>
			) : null}
			<Toggle
				label="Watch history"
				value={settings.watches}
				onChange={(watches) => setSettings({ ...settings, watches })}
			/>
			<Toggle
				label="Ratings"
				value={settings.ratings}
				onChange={(ratings) => setSettings({ ...settings, ratings })}
			/>
			<Text className="font-medium text-foreground">Direction</Text>
			{TRAKT_SYNC_DIRECTIONS.map((choice) => (
				<Pressable
					key={choice.value}
					accessibilityRole="radio"
					accessibilityState={{ checked: settings.direction === choice.value }}
					onPress={() => setSettings({ ...settings, direction: choice.value })}
					className={`rounded-xl border p-3 ${settings.direction === choice.value ? "border-primary bg-primary/10" : "border-border"}`}
				>
					<Text className="text-foreground">
						{settings.direction === choice.value ? "● " : "○ "}
						{choice.label}
					</Text>
				</Pressable>
			))}
			<Text className="font-medium text-foreground">
				Include unlinked records
			</Text>
			{TRAKT_SYNC_SCOPES.map((choice) => (
				<Pressable
					key={choice.value}
					accessibilityRole="radio"
					accessibilityState={{
						checked: settings.historyScope === choice.value,
					}}
					onPress={() =>
						setSettings({ ...settings, historyScope: choice.value })
					}
					className="py-2"
				>
					<Text className="text-foreground">
						{settings.historyScope === choice.value ? "● " : "○ "}
						{choice.label}
					</Text>
				</Pressable>
			))}
			<Text className={copy}>{TRAKT_SCOPE_COPY}</Text>
			{settings.direction !== "outbound" && (
				<Toggle
					label={TRAKT_PUBLICATION_COPY}
					value={settings.publicationConsent}
					onChange={(publicationConsent) =>
						setSettings({ ...settings, publicationConsent })
					}
				/>
			)}
			{unfinished && (
				<View className="gap-3 rounded-xl border border-border p-3">
					<Toggle
						label={TRAKT_HANDOFF_COPY}
						value={settings.handoffImport ?? false}
						onChange={(handoffImport) =>
							setSettings({ ...settings, handoffImport })
						}
					/>
					<Link href="/trakt-import" className="text-primary underline">
						Finish Import first
					</Link>
				</View>
			)}
			{!reviewing ? (
				<Action
					primary
					label="Review sync settings"
					disabled={
						(!settings.watches && !settings.ratings) ||
						(settings.direction !== "outbound" &&
							!settings.publicationConsent) ||
						Boolean(unfinished && !settings.handoffImport)
					}
					onPress={() => setReviewing(true)}
				/>
			) : (
				<View className="gap-3 rounded-xl border border-primary p-3">
					<Text className="font-semibold text-foreground">
						Confirm these transfers
					</Text>
					<Text className={copy}>
						{[
							settings.watches && "Watch history",
							settings.ratings && "Ratings",
						]
							.filter(Boolean)
							.join(" and ")}{" "}
						·{" "}
						{
							TRAKT_SYNC_DIRECTIONS.find((d) => d.value === settings.direction)
								?.label
						}{" "}
						·{" "}
						{
							TRAKT_SYNC_SCOPES.find((s) => s.value === settings.historyScope)
								?.label
						}
					</Text>
					<Text className={copy}>
						Edits and deletions propagate for linked records. Disabling a type
						preserves records. Conflicts that need your choice appear below.
					</Text>
					<Action label="Back" onPress={() => setReviewing(false)} />
					<Action
						primary
						label={
							save.isPending ? "Preparing sync…" : "Confirm and enable sync"
						}
						disabled={save.isPending}
						onPress={() => save.mutate({ body: settings })}
					/>
				</View>
			)}
			{save.error && (
				<Text selectable accessibilityRole="alert" className={copy}>
					{traktError(save.error)}
				</Text>
			)}
			{save.isSuccess && <Text className={copy}>Settings saved</Text>}
		</View>
	);
}

function SyncIssues({ connected }: { connected: boolean }) {
	const [view, setView] = useState<"attention" | "ignored">("attention");
	const result = useInfiniteQuery({
		queryKey: [...rootKey, "issues", view],
		initialPageParam: 1,
		queryFn: async ({ pageParam }) =>
			(
				await traktSyncControllerIssues({
					query: { view, page: pageParam },
					throwOnError: true,
				})
			).data,
		getNextPageParam: (page) => (page.hasNextPage ? page.page + 1 : undefined),
		refetchInterval: 10_000,
	});
	useEndReached(() => {
		if (result.hasNextPage && !result.isFetchingNextPage)
			void result.fetchNextPage();
	});
	const items = result.data?.pages.flatMap((page) => page.items) ?? [];
	return (
		<View className="gap-4">
			<Text className="font-display font-semibold text-2xl text-foreground">
				{view === "attention" ? "Needs attention" : "Ignored"}
			</Text>
			<Action
				label={view === "attention" ? "View ignored" : "Needs attention"}
				onPress={() => setView(view === "attention" ? "ignored" : "attention")}
			/>
			<Text className={copy}>
				Other records keep syncing while you resolve these items. Ignored items
				are not counted as synced.
			</Text>
			{!result.data && result.isPending && (
				<View className={`${card} h-40 animate-pulse`} />
			)}
			{result.error && (
				<Text selectable accessibilityRole="alert" className={copy}>
					{traktError(result.error)}
				</Text>
			)}
			{items.map((item) => (
				<SyncIssue key={item.id} item={item} connected={connected} />
			))}
			{result.data && items.length === 0 && (
				<Text className={copy}>
					{view === "ignored"
						? "No ignored items."
						: "Nothing needs your attention."}
				</Text>
			)}
			{result.isFetchingNextPage && (
				<View className={`${card} h-40 animate-pulse`} />
			)}
			{result.data && (
				<Text className={copy}>
					Showing {items.length} of {result.data.pages[0].total}
				</Text>
			)}
		</View>
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
		<View className={card}>
			<Text selectable className="font-semibold text-foreground text-lg">
				{item.opnshelf?.title ?? item.trakt?.title ?? "Removed record"}
			</Text>
			<Text selectable className={copy}>
				{item.issue}
			</Text>
			<View className="flex-row gap-3">
				{(["opnshelf", "trakt"] as const).map((name) => (
					<View
						key={name}
						className="flex-1 gap-1 rounded-xl bg-background-subtle p-3"
					>
						<Text className="text-muted-foreground text-xs">
							{name === "trakt" ? "Trakt" : "Opnshelf"}
						</Text>
						<Text selectable className="text-foreground text-sm">
							{item[name]?.displayValue ?? "Not present"}
						</Text>
					</View>
				))}
			</View>
			{item.ignored ? (
				<Action
					label="Undo ignore"
					disabled={mutation.isPending}
					onPress={() => resolve({ action: "undo" })}
				/>
			) : (
				<View className="gap-2">
					{connected &&
						((item.opnshelf && item.trakt) ||
							item.issue.includes("changed") ||
							item.issue.includes("version")) &&
						(["trakt", "opnshelf"] as const).map((action) => (
							<Action
								key={action}
								label={traktResolutionLabel(action, Boolean(item[action]))}
								disabled={mutation.isPending}
								onPress={() => setChoice({ action })}
							/>
						))}
					{connected && (
						<Action
							label="Retry"
							disabled={mutation.isPending}
							onPress={() => resolve({ action: "retry" })}
						/>
					)}
					<Action
						label="Ignore this item"
						disabled={mutation.isPending}
						onPress={() => resolve({ action: "ignore" })}
					/>
				</View>
			)}
			{connected &&
				!item.ignored &&
				item.candidates.map((candidate) => (
					<Action
						key={candidate.key}
						label={`Same viewing as ${candidate.title} · ${candidate.displayValue}`}
						disabled={mutation.isPending}
						onPress={() =>
							setChoice({ action: "link", candidateKey: candidate.key })
						}
					/>
				))}
			{connected && !item.ignored && item.candidates.length > 0 && (
				<Action
					label="These are different Watches"
					disabled={mutation.isPending}
					onPress={() => resolve({ action: "separate" })}
				/>
			)}
			{connected && item.trakt?.mediaId === null && (
				<View className="gap-2">
					<Text className="text-foreground text-sm">
						Find the matching title
					</Text>
					<TextInput
						accessibilityLabel="Find the matching title"
						className="rounded-xl border border-border bg-background px-3 py-3 text-foreground"
						value={search}
						onChangeText={setSearch}
						placeholder={item.trakt.title}
						onSubmitEditing={() => setQuery(search)}
					/>
					<Action label="Search" onPress={() => setQuery(search)} />
					{matches.isFetching && (
						<View className="h-14 animate-pulse rounded-xl bg-background-subtle" />
					)}
					{matches.error && (
						<Text selectable accessibilityRole="alert" className={copy}>
							{traktError(matches.error)}
						</Text>
					)}
					{matches.data?.map((m) => (
						<Action
							key={m.tmdbId}
							label={`${m.title}${m.year ? ` (${m.year})` : ""}`}
							onPress={() => setChoice({ action: "match", mediaId: m.tmdbId })}
						/>
					))}
				</View>
			)}
			{choice && (
				<View className="gap-3 rounded-xl border border-primary p-3">
					<Text className={copy}>
						{choice.action === "link"
							? "Confirm these represent the same viewing?"
							: choice.action === "match"
								? "Use this title for this Trakt media identity and its Watch dates?"
								: traktResolutionLabel(
										choice.action,
										Boolean(item[choice.action as "trakt" | "opnshelf"]),
									)}
					</Text>
					{item.kind === "rating" && (
						<Toggle
							label="Apply to all Rating conflicts"
							value={choice.allRatings ?? false}
							onChange={(allRatings) => setChoice({ ...choice, allRatings })}
						/>
					)}
					<Action label="Cancel" onPress={() => setChoice(null)} />
					<Action
						primary
						label={mutation.isPending ? "Saving…" : "Confirm choice"}
						disabled={mutation.isPending}
						onPress={() => resolve(choice)}
					/>
				</View>
			)}
			{mutation.error && (
				<Text selectable accessibilityRole="alert" className={copy}>
					{traktError(mutation.error)}
				</Text>
			)}
		</View>
	);
}
