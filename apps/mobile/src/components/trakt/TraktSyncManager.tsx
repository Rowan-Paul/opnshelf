import {
	type SyncIssueDto,
	type SyncResolveDto,
	type SyncSettingsDto,
	type SyncStatusDto,
	TRAKT_HANDOFF_COPY,
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
import { Image } from "expo-image";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowLeft, ArrowLeftRight, ArrowRight, X } from "lucide-react-native";
import { useState } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	StatusBar,
	Switch,
	Text,
	TextInput,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TraktMark } from "@/components/marks/TraktMark";
import { EndReachedScrollView } from "@/lib/use-end-reached";

function displayValue(value: string) {
	return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))
		? new Date(value).toLocaleString([], {
				dateStyle: "medium",
				timeStyle: "short",
			})
		: value;
}

const rootKey = ["trakt-sync"];
const card = "gap-4 rounded-2xl border border-border bg-card p-4";
const copy = "text-sm leading-5 text-muted-foreground";

function Action({
	label,
	onPress,
	disabled = false,
	primary = false,
	hint,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	primary?: boolean;
	hint?: string;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityHint={hint}
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
	issuesOnly = false,
}: {
	connectionFailed?: boolean;
	embedded?: boolean;
	issuesOnly?: boolean;
}) {
	const insets = useSafeAreaInsets();
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
	if (issuesOnly) return <SyncIssues connected={connected} />;
	const needsSetup =
		connected &&
		data.status === "paused" &&
		data.direction !== "outbound" &&
		!data.publicationConsent &&
		!data.listPublicationConsent &&
		!data.contentPublicationConsent &&
		!data.lastSuccessAt;
	return (
		<View className="gap-5">
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
							<Action label="Sync settings" onPress={() => setEditing(true)} />
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
									<Action
										key={name}
										disabled={
											action.isPending && action.variables?.body.action === name
										}
										label={
											action.isPending && action.variables?.body.action === name
												? "Saving…"
												: name === "sync"
													? traktSyncActionLabel(data)
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
				) : (
					<Action label="Disconnect" onPress={() => setDisconnect(true)} />
				)}
				{disconnect && (
					<Modal
						visible
						transparent
						animationType="slide"
						onRequestClose={() => setDisconnect(false)}
					>
						<View className="flex-1 justify-end bg-black/40">
							<Pressable
								accessibilityLabel="Close confirmation"
								className="flex-1"
								onPress={() => setDisconnect(false)}
								disabled={action.isPending}
							/>
							<View
								accessibilityViewIsModal
								className="max-h-[85%] rounded-t-2xl border border-border bg-card"
								style={{ paddingBottom: Math.max(insets.bottom, 16) }}
							>
								<ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
									<Text
										accessibilityRole="header"
										className="font-semibold text-foreground text-xl"
									>
										Disconnect Trakt?
									</Text>
									<Text className={copy}>
										Disconnecting stops sync and revokes access. Transferred
										records remain on both services. Reconnecting this account
										catches up previously linked records.
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
								</ScrollView>
							</View>
						</View>
					</Modal>
				)}
				{traktSyncStateMessage(data) && (
					<Text accessibilityLiveRegion="polite" className={copy}>
						{traktSyncStateMessage(data)}
					</Text>
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
			{connected && needsSetup && !editing && (
				<SyncSettings
					key={`${data.username}:${data.direction}:${data.watches}:${data.ratings}:${data.lists}:${data.watchlist}:${data.favorites}:${data.notes}:${data.library}:${data.reviews}:${data.contentPublicationConsent}:${data.listPublicationConsent}:${data.historyScope}`}
					status={data}
					className={embedded ? "gap-4 border-border border-t pt-4" : card}
					onSaved={() => {
						setEditing(false);
						return refresh();
					}}
					onCancel={editing ? () => setEditing(false) : undefined}
				/>
			)}
			{editing && (
				<Modal
					visible
					presentationStyle="pageSheet"
					animationType="slide"
					onRequestClose={() => setEditing(false)}
				>
					<ScrollView
						contentInsetAdjustmentBehavior="automatic"
						className="bg-background"
						contentContainerClassName="gap-5 px-5"
						contentContainerStyle={{
							paddingTop:
								Math.max(insets.top, StatusBar.currentHeight ?? 0) + 24,
							paddingBottom: insets.bottom + 32,
						}}
					>
						{editing && (
							<SyncSettings
								status={data}
								className="gap-4"
								onSaved={() => {
									setEditing(false);
									return refresh();
								}}
								onCancel={() => setEditing(false)}
							/>
						)}
					</ScrollView>
				</Modal>
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
				(connected || data.needsAttention > 0 || data.ignored > 0) && (
					<View className={card}>
						<Text className="font-semibold text-foreground text-lg">
							Needs attention
						</Text>
						<Text className={copy}>
							{data.needsAttention}{" "}
							{data.needsAttention === 1 ? "item" : "items"} to review ·{" "}
							{data.ignored} ignored. Other records keep syncing.
						</Text>
						<Link
							href="/trakt-sync/attention"
							className="font-semibold text-primary"
						>
							Review items →
						</Link>
					</View>
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
	const [choosingRecords, setChoosingRecords] = useState(false);
	const { width, fontScale } = useWindowDimensions();
	const compactDirections = width / fontScale < 480;
	const insets = useSafeAreaInsets();
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
	const unfinished =
		status.importStatus &&
		!["completed", "continued_in_sync"].includes(status.importStatus);
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
	const canSave = hasConsent && (!unfinished || settings.handoffImport);
	const dismiss = () => {
		if (!save.isPending) setReviewing(false);
	};
	return (
		<View className={className}>
			{showHeading && (
				<Text
					accessibilityRole="header"
					className="font-semibold text-foreground text-lg"
				>
					Sync settings
				</Text>
			)}
			<View className="gap-3">
				<View className="flex-row items-start justify-between gap-4">
					<View className="flex-1 gap-1">
						<Text className="font-medium text-foreground text-sm">Records</Text>
						<Text className={copy}>
							{TRAKT_SYNC_RECORDS.filter(({ value }) => settings[value])
								.map(({ label }) => label)
								.join(", ") || "Choose at least one record type"}
						</Text>
					</View>
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ expanded: choosingRecords }}
						className="min-h-11 justify-center"
						onPress={() => setChoosingRecords(true)}
					>
						<Text className="font-medium text-primary text-sm">
							Choose records
						</Text>
					</Pressable>
				</View>
				{choosingRecords && (
					<Modal
						visible
						presentationStyle="pageSheet"
						animationType="slide"
						onRequestClose={() => setChoosingRecords(false)}
					>
						<ScrollView
							contentInsetAdjustmentBehavior="automatic"
							className="bg-background"
							contentContainerClassName="gap-4 px-5"
							contentContainerStyle={{
								paddingTop:
									Math.max(insets.top, StatusBar.currentHeight ?? 0) + 24,
								paddingBottom: insets.bottom + 32,
							}}
						>
							<Text
								accessibilityRole="header"
								className="font-semibold text-foreground text-xl"
							>
								Choose records
							</Text>
							<Text className={copy}>Choose what to sync.</Text>
							{TRAKT_SYNC_RECORDS.map(({ value, label }) => (
								<Toggle
									key={value}
									label={label}
									value={settings[value] ?? false}
									onChange={(selected) =>
										setSettings({ ...settings, [value]: selected })
									}
								/>
							))}
							<Action label="Done" onPress={() => setChoosingRecords(false)} />
						</ScrollView>
					</Modal>
				)}
			</View>
			<Text className="font-medium text-foreground text-sm">Direction</Text>
			<View
				accessibilityRole="radiogroup"
				accessibilityLabel="Direction"
				className={compactDirections ? "gap-2" : "flex-row gap-2"}
			>
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
							className={`items-center rounded-xl border ${compactDirections ? "min-h-16 flex-row gap-4 p-4" : "flex-1 gap-2 px-2 py-4"} ${settings.direction === choice.value ? "border-primary bg-primary/10" : "border-border"}`}
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
							<View
								className={
									compactDirections ? "flex-1 gap-1" : "items-center gap-2"
								}
							>
								<Text
									className={`${compactDirections ? "" : "text-center"} font-semibold text-foreground text-sm`}
								>
									{choice.title}
								</Text>
								<Text
									className={`${compactDirections ? "" : "text-center"} text-muted-foreground text-xs leading-4`}
								>
									{choice.description}
								</Text>
							</View>
						</Pressable>
					);
				})}
			</View>
			<Text className="font-medium text-foreground text-sm">History</Text>
			<View
				accessibilityRole="radiogroup"
				accessibilityLabel="History"
				className="gap-2"
			>
				{TRAKT_SYNC_SCOPES.map((choice) => {
					const selected = settings.historyScope === choice.value;
					return (
						<Pressable
							key={choice.value}
							accessibilityRole="radio"
							accessibilityLabel={choice.label}
							accessibilityState={{ checked: selected }}
							onPress={() =>
								setSettings({ ...settings, historyScope: choice.value })
							}
							className={`min-h-11 flex-row items-center gap-3 rounded-xl border px-3 py-3 ${selected ? "border-primary bg-primary/10" : "border-border bg-background-subtle"}`}
						>
							<View
								accessible={false}
								className={`size-5 items-center justify-center rounded-full border-2 ${selected ? "border-primary" : "border-muted-foreground"}`}
							>
								{selected && (
									<View className="size-2.5 rounded-full bg-primary" />
								)}
							</View>
							<Text className="flex-1 text-foreground text-sm">
								{choice.label}
							</Text>
						</Pressable>
					);
				})}
			</View>
			<Text className={copy}>{TRAKT_SCOPE_COPY}</Text>
			<Action
				primary
				label={
					onboarding ? "Continue" : managed ? "Save changes" : "Enable sync"
				}
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
								(hadConsent ? (
									<Text className={copy}>{TRAKT_PUBLICATION_COPY}</Text>
								) : (
									<Toggle
										label={TRAKT_PUBLICATION_COPY}
										value={hasConsent}
										onChange={(consent) =>
											setSettings({
												...settings,
												publicationConsent: consent,
												listPublicationConsent: consent,
												contentPublicationConsent: consent,
											})
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
										onPress={() => setReviewing(false)}
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

function SyncIssues({
	connected,
	view = "attention",
}: {
	connected: boolean;
	view?: "attention" | "ignored";
}) {
	const [ignoredOpen, setIgnoredOpen] = useState(false);
	const insets = useSafeAreaInsets();
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
	const items = result.data?.items ?? [];
	return (
		<View className="gap-4">
			{view === "attention" && (
				<>
					<Text
						accessibilityRole="header"
						className="font-display font-semibold text-2xl text-foreground"
					>
						Needs attention
					</Text>
					<Action label="View ignored" onPress={() => setIgnoredOpen(true)} />
				</>
			)}
			<Text className={copy}>
				{view === "ignored"
					? "Ignored items aren’t synced. Restore an item to move it back to Needs attention."
					: "Other records keep syncing while you resolve these items. Ignored items are not counted as synced."}
			</Text>
			{!result.data && result.isPending && (
				<View accessibilityLabel="Loading sync items" className={card}>
					<View className="h-5 w-40 rounded bg-background-subtle" />
					<View className="h-4 w-full rounded bg-background-subtle" />
					<View className="flex-row gap-3">
						<View className="h-16 flex-1 rounded-xl bg-background-subtle" />
						<View className="h-16 flex-1 rounded-xl bg-background-subtle" />
					</View>
					<View className="h-12 rounded-full bg-background-subtle" />
					<View className="h-12 rounded-full bg-background-subtle" />
				</View>
			)}
			{result.error && (
				<Text selectable accessibilityRole="alert" className={copy}>
					{traktError(result.error)}
				</Text>
			)}
			{result.data && result.data.total > 0 && (
				<View className="flex-row items-center justify-between gap-3">
					<Action
						label="Previous"
						disabled={!result.data.hasPreviousPage || result.isPlaceholderData}
						onPress={() => setPage(result.data.page - 1)}
					/>
					<Text accessibilityLiveRegion="polite" className={copy}>
						Item {result.data.page} of {result.data.total}
					</Text>
					<Action
						label="Next"
						disabled={!result.data.hasNextPage || result.isPlaceholderData}
						onPress={() => setPage(result.data.page + 1)}
					/>
				</View>
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
			{view === "attention" && ignoredOpen && (
				<Modal
					visible
					presentationStyle="pageSheet"
					animationType="slide"
					onRequestClose={() => setIgnoredOpen(false)}
				>
					<EndReachedScrollView
						contentInsetAdjustmentBehavior="automatic"
						className="bg-background"
						contentContainerClassName="gap-4 px-5"
						contentContainerStyle={{
							paddingTop:
								Math.max(insets.top, StatusBar.currentHeight ?? 0) + 24,
							paddingBottom: insets.bottom + 32,
						}}
					>
						<View className="flex-row items-center justify-between gap-3">
							<Text
								accessibilityRole="header"
								className="font-display font-semibold text-2xl text-foreground"
							>
								Ignored items
							</Text>
							<Action label="Done" onPress={() => setIgnoredOpen(false)} />
						</View>
						<SyncIssues connected={connected} view="ignored" />
					</EndReachedScrollView>
				</Modal>
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
	const insets = useSafeAreaInsets();
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
				{traktRecordTitle(item.opnshelf) ??
					traktRecordTitle(item.trakt) ??
					"Removed record"}
			</Text>
			<Text selectable className={copy}>
				{traktIssueRecovery(item) === "verify"
					? "Saved in Opnshelf. We couldn’t confirm whether Trakt received it. Check again, or check your Trakt account before choosing a version."
					: item.issue}
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
							{(item[name]?.displayValue
								? displayValue(item[name].displayValue)
								: undefined) ??
								(name === "trakt" && traktIssueRecovery(item) === "verify"
									? "Not confirmed yet"
									: "Not present")}
						</Text>
					</View>
				))}
			</View>
			{item.ignored ? (
				<Action
					label="Restore item"
					disabled={mutation.isPending}
					onPress={() => resolve({ action: "undo" })}
				/>
			) : (
				<View className="gap-2">
					{connected &&
						traktIssueRecovery(item) !== "retry" &&
						(["trakt", "opnshelf"] as const).map((action) => (
							<Action
								key={action}
								label={
									traktIssueRecovery(item) === "verify"
										? action === "opnshelf"
											? "Send after checking Trakt"
											: "Remove from Opnshelf"
										: traktResolutionLabel(action, Boolean(item[action]))
								}
								disabled={mutation.isPending}
								onPress={() =>
									setChoice({
										action,
										...(traktIssueRecovery(item) === "verify"
											? { confirmedTraktMissing: false }
											: {}),
									})
								}
							/>
						))}
					{connected && (
						<Action
							label={
								traktIssueRecovery(item) === "verify" ? "Check again" : "Retry"
							}
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
					<View key={candidate.key} className="gap-3">
						<View className="gap-1">
							<Text className="text-muted-foreground text-xs">
								Existing {item.kind === "watch" ? "Watch" : "record"} in{" "}
								{item.opnshelf ? "Trakt" : "Opnshelf"}
							</Text>
							<Text
								selectable
								className="font-semibold text-foreground text-sm"
							>
								{traktRecordTitle(candidate)}
							</Text>
							<Text selectable className={copy}>
								{displayValue(candidate.displayValue)}
							</Text>
						</View>
						<Action
							primary
							label={`Link this ${item.kind === "watch" ? "Watch" : "record"}`}
							hint={`${traktRecordTitle(candidate)} · ${displayValue(candidate.displayValue)}`}
							disabled={mutation.isPending}
							onPress={() =>
								setChoice({ action: "link", candidateKey: candidate.key })
							}
						/>
					</View>
				))}
			{connected && !item.ignored && item.candidates.length > 0 && (
				<Action
					label={
						item.kind === "watch"
							? "These are different Watches"
							: "These are separate records"
					}
					disabled={mutation.isPending}
					onPress={() => resolve({ action: "separate" })}
				/>
			)}
			{connected &&
				item.kind !== "list" &&
				item.kind !== "watchlist" &&
				item.kind !== "favorites" &&
				item.trakt?.mediaId === null &&
				item.trakt?.mediaType !== "list" && (
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
								onPress={() =>
									setChoice({ action: "match", mediaId: m.tmdbId })
								}
							/>
						))}
					</View>
				)}
			{choice && (
				<Modal
					visible
					transparent
					animationType="slide"
					onRequestClose={() => setChoice(null)}
				>
					<View className="flex-1 justify-end bg-black/40">
						<Pressable
							accessibilityLabel="Close confirmation"
							className="flex-1"
							onPress={() => setChoice(null)}
							disabled={mutation.isPending}
						/>
						<View
							accessibilityViewIsModal
							className="max-h-[85%] rounded-t-2xl border border-border bg-card"
							style={{ paddingBottom: Math.max(insets.bottom, 16) }}
						>
							<ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
								<Text
									accessibilityRole="header"
									className="font-semibold text-foreground text-xl"
								>
									Confirm sync choice
								</Text>
								<Text className={copy}>
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
								</Text>
								{choice.confirmedTraktMissing !== undefined && (
									<View className="gap-3">
										<Text className={copy}>
											{TRAKT_UNCONFIRMED_CHOICE_COPY}
										</Text>
										<Toggle
											label={TRAKT_MISSING_CONFIRMATION}
											value={choice.confirmedTraktMissing}
											onChange={(confirmedTraktMissing) =>
												setChoice({ ...choice, confirmedTraktMissing })
											}
										/>
									</View>
								)}
								{item.kind === "rating" && (
									<Toggle
										label="Apply to all Rating conflicts"
										value={choice.allRatings ?? false}
										onChange={(allRatings) =>
											setChoice({ ...choice, allRatings })
										}
									/>
								)}
								{mutation.error && (
									<Text accessibilityRole="alert" className={copy}>
										{traktError(mutation.error)}
									</Text>
								)}
								<Action label="Cancel" onPress={() => setChoice(null)} />
								<Action
									primary
									label={mutation.isPending ? "Saving…" : "Confirm choice"}
									disabled={
										mutation.isPending || choice.confirmedTraktMissing === false
									}
									onPress={() => resolve(choice)}
								/>
							</ScrollView>
						</View>
					</View>
				</Modal>
			)}
			{mutation.error && (
				<Text selectable accessibilityRole="alert" className={copy}>
					{traktError(mutation.error)}
				</Text>
			)}
		</View>
	);
}
