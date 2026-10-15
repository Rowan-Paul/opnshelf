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
import { Image } from "expo-image";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowLeft, ArrowLeftRight, ArrowRight, X } from "lucide-react-native";
import { useState } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	Switch,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TraktMark } from "@/components/marks/TraktMark";
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
	const [editing, setEditing] = useState(false);
	if (!status.data)
		return status.isError ? (
			<View className={embedded ? "gap-4" : card}>
				<Text selectable accessibilityRole="alert" className={copy}>
					{traktError(status.error)}
				</Text>
				<Action label="Retry" onPress={() => void status.refetch()} />
			</View>
		) : (
			<View
				accessibilityLabel="Loading Trakt Sync"
				className={`${embedded ? "gap-4" : card} animate-pulse`}
			>
				<View className="h-5 w-36 rounded bg-background-subtle" />
				<View className="h-4 w-24 rounded bg-background-subtle" />
				<View className="h-8 w-64 rounded bg-background-subtle" />
				<View className="h-4 rounded bg-background-subtle" />
				<View className="h-11 rounded bg-background-subtle" />
			</View>
		);
	const data = status.data;
	const connected =
		data.status !== "disconnected" && data.status !== "reconnect";
	const needsSetup =
		connected &&
		data.status === "paused" &&
		data.direction !== "outbound" &&
		!data.publicationConsent &&
		!data.lastSuccessAt;
	return (
		<View className="gap-5">
			{!embedded && (
				<Link href="/settings/connections" className="text-primary text-sm">
					‹ Back to Settings
				</Link>
			)}

			<View className={embedded ? "gap-4" : card}>
				<Text selectable className="font-semibold text-foreground text-lg">
					{data.username ? `@${data.username}` : "Connect your Trakt account"}
				</Text>
				<Text className={copy}>
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
				) : !needsSetup ? (
					<>
						<View className="flex-row flex-wrap gap-2">
							<Text className="rounded-lg bg-background-subtle px-3 py-2 font-medium text-foreground text-sm">
								{
									TRAKT_SYNC_DIRECTIONS.find(
										(choice) => choice.value === data.direction,
									)?.label
								}
							</Text>
							<Text className="rounded-lg bg-background-subtle px-3 py-2 text-foreground text-sm">
								{[data.watches && "Watch history", data.ratings && "Ratings"]
									.filter(Boolean)
									.join(" and ")}
							</Text>
						</View>
						<Text selectable className={copy}>
							{data.lastSuccessAt
								? `Last successful check: ${new Date(data.lastSuccessAt).toLocaleString()}`
								: "No successful sync yet."}{" "}
							Trakt is checked about every 15 minutes; rate limits can delay
							transfers.
						</Text>
						<View className="flex-row flex-wrap gap-2">
							<Action
								label="Sync settings"
								onPress={() => setEditing(!editing)}
							/>
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
				) : null}
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
			{connected && (editing || needsSetup) && (
				<SyncSettings
					key={`${data.username}:${data.direction}:${data.watches}:${data.ratings}:${data.historyScope}`}
					status={data}
					className={embedded ? "gap-4 border-border border-t pt-4" : card}
					onSaved={() => {
						setEditing(false);
						return refresh();
					}}
					onCancel={editing ? () => setEditing(false) : undefined}
				/>
			)}
			{embedded && (data.status === "disconnected" || data.importStatus) && (
				<Link
					href="/trakt-import"
					className="text-muted-foreground text-sm underline"
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
		</View>
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
	const insets = useSafeAreaInsets();
	const managed =
		status.status === "active" ||
		status.status === "preparing" ||
		status.direction === "outbound" ||
		Boolean(status.lastSuccessAt || status.publicationConsent);
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
	const requiresConsent = settings.direction !== "outbound";
	const canSave =
		(!requiresConsent || settings.publicationConsent) &&
		(!unfinished || settings.handoffImport);
	const dismiss = () => {
		if (!save.isPending) setReviewing(false);
	};
	return (
		<View className={className}>
			{showHeading && (
				<Text className="font-semibold text-foreground text-lg">
					Sync settings
				</Text>
			)}
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
			<Text className="font-medium text-foreground text-sm">Direction</Text>
			<View accessibilityRole="radiogroup" className="flex-row gap-2">
				{TRAKT_SYNC_DIRECTIONS.map((choice) => {
					const Arrow =
						choice.value === "inbound"
							? ArrowRight
							: choice.value === "outbound"
								? ArrowLeft
								: ArrowLeftRight;
					return (
						<Pressable
							key={choice.value}
							accessibilityRole="radio"
							accessibilityLabel={choice.label}
							accessibilityState={{
								checked: settings.direction === choice.value,
							}}
							onPress={() =>
								setSettings({ ...settings, direction: choice.value })
							}
							className={`flex-1 items-center gap-2 rounded-xl border px-2 py-4 ${settings.direction === choice.value ? "border-primary bg-primary/10" : "border-border"}`}
						>
							<View
								importantForAccessibility="no-hide-descendants"
								className="flex-row items-center gap-2"
							>
								<TraktMark size={20} />
								<Arrow size={16} color="#94a3b8" />
								<Image
									source={require("../../../assets/images/icon.png")}
									style={{ width: 20, height: 20, borderRadius: 5 }}
								/>
							</View>
							<Text className="text-center font-semibold text-foreground text-sm">
								{choice.title}
							</Text>
							<Text className="text-center text-muted-foreground text-xs leading-4">
								{choice.description}
							</Text>
						</Pressable>
					);
				})}
			</View>
			<Text className="font-medium text-foreground text-sm">History</Text>
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
					<Text className="text-foreground text-sm">
						{settings.historyScope === choice.value ? "● " : "○ "}
						{choice.label}
					</Text>
				</Pressable>
			))}
			<Text className={copy}>{TRAKT_SCOPE_COPY}</Text>
			<Action
				primary
				label={
					onboarding ? "Continue" : managed ? "Save changes" : "Enable sync"
				}
				disabled={!settings.watches && !settings.ratings}
				onPress={() => setReviewing(true)}
			/>
			{onCancel && <Action label="Cancel" onPress={onCancel} />}
			{save.isSuccess && (
				<Text accessibilityRole="alert" className={copy}>
					Settings saved
				</Text>
			)}
			<Modal
				visible={reviewing}
				animationType="slide"
				transparent
				onRequestClose={dismiss}
			>
				<View className="flex-1 justify-end bg-black/40">
					<Pressable
						accessibilityLabel="Close confirmation"
						className="flex-1"
						onPress={dismiss}
						disabled={save.isPending}
					/>
					<View
						accessibilityViewIsModal
						className="max-h-[85%] rounded-t-2xl border border-border bg-card"
						style={{ paddingBottom: Math.max(insets.bottom, 16) }}
					>
						<ScrollView
							contentContainerStyle={{ padding: 20, gap: 16 }}
							keyboardShouldPersistTaps="handled"
						>
							<View className="flex-row items-center justify-between gap-3">
								<Text
									accessibilityRole="header"
									className="flex-1 font-display font-semibold text-foreground text-xl"
								>
									{managed ? "Update Trakt Sync" : "Enable Trakt Sync"}
								</Text>
								<Pressable
									accessibilityRole="button"
									accessibilityLabel="Close confirmation"
									onPress={dismiss}
									disabled={save.isPending}
									hitSlop={12}
								>
									<X size={22} color="#94a3b8" />
								</Pressable>
							</View>
							<Text className={copy}>
								Confirm what will move between your accounts.
							</Text>
							<View className="gap-3 rounded-xl bg-background-subtle p-4">
								{[
									[
										"Records",
										[
											settings.watches && "Watch history",
											settings.ratings && "Ratings",
										]
											.filter(Boolean)
											.join(" and "),
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
									<View key={label} className="gap-1">
										<Text className="text-muted-foreground text-xs">
											{label}
										</Text>
										<Text
											selectable
											className="font-medium text-foreground text-sm"
										>
											{value}
										</Text>
									</View>
								))}
							</View>
							<Text className={copy}>
								Edits and deletions propagate for linked records. Disabling a
								type preserves records. Conflicts that need your choice appear
								in Settings.
							</Text>
							{requiresConsent &&
								(status.publicationConsent ? (
									<Text className={copy}>
										Watches and Ratings brought into Opnshelf become public,
										even if your Trakt profile is private.
									</Text>
								) : (
									<Toggle
										label={TRAKT_PUBLICATION_COPY}
										value={settings.publicationConsent}
										onChange={(publicationConsent) =>
											setSettings({ ...settings, publicationConsent })
										}
									/>
								))}
							{unfinished && (
								<View className="gap-3 rounded-xl border border-border p-3">
									<Toggle
										label={TRAKT_HANDOFF_COPY}
										value={settings.handoffImport ?? false}
										onChange={(handoffImport) =>
											setSettings({ ...settings, handoffImport })
										}
									/>
									<Link
										href="/trakt-import"
										className="text-primary text-sm underline"
									>
										Finish Import first
									</Link>
								</View>
							)}
							{save.error && (
								<Text
									selectable
									accessibilityRole="alert"
									className="text-destructive text-sm"
								>
									{traktError(save.error)}
								</Text>
							)}
							<Action
								primary
								label={
									save.isPending
										? "Saving…"
										: onboarding
											? "Enable sync and continue"
											: managed
												? status.status === "paused"
													? "Save and resume sync"
													: "Confirm changes"
												: "Confirm and enable sync"
								}
								disabled={save.isPending || !canSave}
								onPress={() => save.mutate({ body: settings })}
							/>
							<Action
								label="Back"
								disabled={save.isPending}
								onPress={dismiss}
							/>
						</ScrollView>
					</View>
				</View>
			</Modal>
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
