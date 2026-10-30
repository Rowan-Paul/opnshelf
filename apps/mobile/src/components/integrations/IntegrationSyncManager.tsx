import {
	authControllerPermissions,
	type IntegrationDefinition,
	type IntegrationIssueDto,
	type IntegrationResolveDto,
	integrationActionLabel,
	integrationDirections,
	integrationIssueRecovery,
	integrationKey,
	integrationMissingConfirmation,
	integrationRecords,
	integrationResolutionLabel,
	integrationStateMessage,
	integrationUnconfirmedChoiceCopy,
	integrationWriteGrantCopy,
	type SyncActionDto,
	type SyncSettingsDto,
	type SyncStatusDto,
	TRAKT_PUBLICATION_COPY,
	TRAKT_SCOPE_COPY,
	TRAKT_SYNC_SCOPES,
	traktError,
	traktRecordTitle,
	traktSettings,
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
import { IntegrationMark } from "@/components/integrations/IntegrationMark";
import { useAuth } from "@/lib/auth-context";
import { beginHandoff } from "@/lib/auth-handoff";
import { EndReachedScrollView } from "@/lib/use-end-reached";
import { useThemeColors } from "@/theme/colors";

function displayValue(value: string) {
	return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))
		? new Date(value).toLocaleString([], {
				dateStyle: "medium",
				timeStyle: "short",
			})
		: value;
}

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

export function IntegrationSyncManager({
	integration,
	connectionFailed = false,
	embedded = false,
	issuesOnly = false,
}: {
	integration: IntegrationDefinition;
	connectionFailed?: boolean;
	embedded?: boolean;
	issuesOnly?: boolean;
}) {
	const { id, name } = integration;
	const rootKey = integrationKey(integration);
	const insets = useSafeAreaInsets();
	const queryClient = useQueryClient();
	const refresh = () => queryClient.invalidateQueries({ queryKey: rootKey });
	const status = useQuery({
		queryKey: [...rootKey, "status"],
		queryFn: ({ signal }) => integration.api.status(signal),
		refetchInterval: 5000,
	});
	const connect = useMutation({
		mutationKey: [...rootKey, "connect"],
		mutationFn: integration.api.connect,
		onSuccess: async (data) => {
			if (data.url) {
				// Trakt's OAuth callback still returns to its original app link.
				const result = await WebBrowser.openAuthSessionAsync(
					data.url,
					"opnshelf://trakt-sync",
				);
				if (
					result.type === "success" &&
					new URL(result.url).searchParams.get("connection") === "failed"
				)
					throw new Error(`${name} could not connect. Try connecting again.`);
			}
			await refresh();
		},
	});
	const action = useMutation({
		mutationKey: [...rootKey, "action"],
		mutationFn: (choice: SyncActionDto["action"]) =>
			integration.api.action(choice),
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
				accessibilityLabel={`Loading ${name} Sync`}
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
	if (issuesOnly)
		return <SyncIssues integration={integration} connected={connected} />;
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
					{data.username
						? `@${data.username}`
						: integration.connect === "oauth"
							? `Connect your ${name} account`
							: `Use your ${name} records`}
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
										: integration.connect === "oauth"
											? "No account connected"
											: "Not connected"}
				</Text>
				{connected && integration.writeGrant && data.writeAccess && (
					<WriteAccess
						integration={integration}
						removable={data.direction === "inbound"}
					/>
				)}
				{!data.configured ? (
					<Text className={copy}>
						{name} Sync is not configured on this server yet.
					</Text>
				) : !connected ? (
					<Action
						primary
						label={
							connect.isPending
								? integration.connect === "oauth"
									? `Opening ${name}…`
									: "Connecting…"
								: data.status === "reconnect"
									? `Reconnect ${name}`
									: `Connect ${name}`
						}
						disabled={connect.isPending}
						onPress={() => connect.mutate({ platform: "mobile" })}
					/>
				) : !needsSetup ? (
					<>
						<View className="flex-row flex-wrap gap-2">
							<Text className="rounded-lg bg-background-subtle px-3 py-2 font-medium text-foreground text-sm">
								{
									integrationDirections(integration).find(
										(choice) => choice.value === data.direction,
									)?.label
								}
							</Text>
							<Text className="rounded-lg bg-background-subtle px-3 py-2 text-foreground text-sm">
								{integrationRecords(integration)
									.filter(({ value }) => data[value])
									.map(({ label }) => label)
									.join(", ")}
							</Text>
						</View>
						<Text selectable className={copy}>
							{data.lastSuccessAt
								? `Last successful check: ${new Date(data.lastSuccessAt).toLocaleString()}`
								: "No successful sync yet."}{" "}
							{integration.checkCopy}
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
									(choice) =>
										choice !== "sync" ||
										!["running", "queued", "waiting"].includes(
											data.syncState ?? "",
										),
								)
								.map((choice) => (
									<Action
										key={choice}
										disabled={action.isPending && action.variables === choice}
										label={
											action.isPending && action.variables === choice
												? "Saving…"
												: choice === "sync"
													? integrationActionLabel(data, name)
													: choice === "pause"
														? "Pause"
														: "Resume"
										}
										onPress={() => action.mutate(choice)}
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
										Disconnect {name}?
									</Text>
									<Text className={copy}>
										{integration.connect === "oauth"
											? "Disconnecting stops sync and revokes access. Transferred records remain on both services. Reconnecting this account catches up previously linked records."
											: `Disconnecting stops sync. Transferred records stay in Opnshelf and your ${name} records are untouched. Reconnecting catches up previously linked records.`}
									</Text>
									<Action label="Cancel" onPress={() => setDisconnect(false)} />
									<Action
										primary
										label="Confirm disconnect"
										disabled={action.isPending}
										onPress={() =>
											action.mutate("disconnect", {
												onSuccess: () => setDisconnect(false),
											})
										}
									/>
								</ScrollView>
							</View>
						</View>
					</Modal>
				)}
				{integrationStateMessage(data, name) && (
					<Text accessibilityLiveRegion="polite" className={copy}>
						{integrationStateMessage(data, name)}
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
							? `${name} could not connect. Try connecting again.`
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
					integration={integration}
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
								integration={integration}
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
							href={{
								pathname: "/integrations/[provider]/attention",
								params: { provider: id },
							}}
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
	integration,
	status,
	onSaved,
	className = card,
	showHeading = true,
	onboarding = false,
	onCancel,
}: {
	integration: IntegrationDefinition;
	status: SyncStatusDto;
	onSaved: () => unknown;
	className?: string;
	showHeading?: boolean;
	onboarding?: boolean;
	onCancel?: () => void;
}) {
	const colors = useThemeColors();
	const { name } = integration;
	const records = integrationRecords(integration);
	const directions = integrationDirections(integration);
	const [settings, setSettings] = useState<SyncSettingsDto>(() => {
		const saved = traktSettings(status);
		return integration.directions.includes(saved.direction)
			? saved
			: { ...saved, direction: integration.directions[0] };
	});
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
		mutationKey: [...integrationKey(integration), "configure"],
		mutationFn: integration.api.configure,
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
	const needsGrant = Boolean(
		integration.writeGrant &&
			settings.direction !== "inbound" &&
			!status.writeAccess,
	);
	const canSave = hasConsent && !needsGrant;
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
							{records
								.filter(({ value }) => settings[value])
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
							{records.map(({ value, label }) => (
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
			{integration.directionNote && (
				<Text className={copy}>{integration.directionNote}</Text>
			)}
			<View
				accessibilityRole="radiogroup"
				accessibilityLabel="Direction"
				className={
					compactDirections || directions.length === 1
						? "gap-2"
						: "flex-row gap-2"
				}
			>
				{directions.map((choice) => {
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
								<IntegrationMark id={integration.id} size={20} />
								<Arrow size={16} color={colors.mutedForeground} />
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
			{needsGrant && <WriteGrant integration={integration} />}
			<Action
				primary
				label={
					onboarding ? "Continue" : managed ? "Save changes" : "Enable sync"
				}
				disabled={
					needsGrant ||
					(!settings.watches &&
						!settings.ratings &&
						!settings.lists &&
						!settings.watchlist &&
						!settings.favorites &&
						!settings.notes &&
						!settings.library &&
						!settings.reviews)
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
									className="flex-1 font-display-semibold text-foreground text-xl"
								>
									{managed ? `Update ${name} Sync` : `Enable ${name} Sync`}
								</Text>
								<Pressable
									accessibilityRole="button"
									accessibilityLabel="Close confirmation"
									onPress={dismiss}
									disabled={save.isPending}
									hitSlop={12}
								>
									<X size={22} color={colors.mutedForeground} />
								</Pressable>
							</View>
							<Text className={copy}>
								Confirm what will move between your accounts.
							</Text>
							<View className="gap-3 rounded-xl bg-background-subtle p-4">
								{[
									[
										"Records",
										records
											.filter(({ value }) => settings[value])
											.map(({ label }) => label)
											.join(", "),
									],
									[
										"Direction",
										directions.find(
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
								onPress={() => save.mutate(settings)}
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
	integration,
	connected,
	view = "attention",
}: {
	integration: IntegrationDefinition;
	connected: boolean;
	view?: "attention" | "ignored";
}) {
	const rootKey = integrationKey(integration);
	const [ignoredOpen, setIgnoredOpen] = useState(false);
	const insets = useSafeAreaInsets();
	const [page, setPage] = useState(1);
	const result = useQuery({
		queryKey: [...rootKey, "issues", view, page],
		queryFn: ({ signal }) =>
			integration.api.issues({ view, page, pageSize: 1 }, signal),
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
						className="font-display-semibold text-2xl text-foreground"
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
				<SyncIssue
					key={item.id}
					integration={integration}
					item={item}
					connected={connected}
				/>
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
								className="font-display-semibold text-2xl text-foreground"
							>
								Ignored items
							</Text>
							<Action label="Done" onPress={() => setIgnoredOpen(false)} />
						</View>
						<SyncIssues
							integration={integration}
							connected={connected}
							view="ignored"
						/>
					</EndReachedScrollView>
				</Modal>
			)}
		</View>
	);
}

function SyncIssue({
	integration,
	item,
	connected,
}: {
	integration: IntegrationDefinition;
	item: IntegrationIssueDto;
	connected: boolean;
}) {
	const { name } = integration;
	const rootKey = integrationKey(integration);
	const insets = useSafeAreaInsets();
	const client = useQueryClient();
	const [choice, setChoice] = useState<IntegrationResolveDto | null>(null);
	const [search, setSearch] = useState("");
	const [query, setQuery] = useState<string | null>(null);
	const mutation = useMutation({
		mutationKey: [...rootKey, "issues", "resolve"],
		mutationFn: (body: IntegrationResolveDto) =>
			integration.api.resolve(item.id, body),
		onSuccess: () => {
			setChoice(null);
			void client.invalidateQueries({ queryKey: rootKey });
		},
	});
	const matches = useQuery({
		queryKey: [...rootKey, "issues", item.id, "matches", query],
		queryFn: ({ signal }) =>
			integration.api.matches(item.id, query ?? "", signal),
		enabled: query !== null,
	});
	const resolve = (body: IntegrationResolveDto) => mutation.mutate(body);
	return (
		<View className={card}>
			<Text selectable className="font-semibold text-foreground text-lg">
				{traktRecordTitle(item.opnshelf) ??
					traktRecordTitle(item.remote) ??
					"Removed record"}
			</Text>
			<Text selectable className={copy}>
				{integrationIssueRecovery(item) === "verify"
					? `Saved in Opnshelf. We couldn’t confirm whether ${name} received it. Check again, or check your ${name} account before choosing a version.`
					: item.issue}
			</Text>
			<View className="flex-row gap-3">
				{(["opnshelf", "remote"] as const).map((side) => (
					<View
						key={side}
						className="flex-1 gap-1 rounded-xl bg-background-subtle p-3"
					>
						<Text className="text-muted-foreground text-xs">
							{side === "remote" ? name : "Opnshelf"}
						</Text>
						<Text selectable className="text-foreground text-sm">
							{(item[side]?.displayValue
								? displayValue(item[side].displayValue)
								: undefined) ??
								(side === "remote" &&
								integrationIssueRecovery(item) === "verify"
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
						integrationIssueRecovery(item) !== "retry" &&
						(["remote", "opnshelf"] as const).map((action) => (
							<Action
								key={action}
								label={
									integrationIssueRecovery(item) === "verify"
										? action === "opnshelf"
											? `Send after checking ${name}`
											: "Remove from Opnshelf"
										: integrationResolutionLabel(
												action,
												Boolean(item[action]),
												name,
											)
								}
								disabled={mutation.isPending}
								onPress={() =>
									setChoice({
										action,
										...(integrationIssueRecovery(item) === "verify"
											? { confirmedRemoteMissing: false }
											: {}),
									})
								}
							/>
						))}
					{connected && (
						<Action
							label={
								integrationIssueRecovery(item) === "verify"
									? "Check again"
									: "Retry"
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
								{item.opnshelf ? name : "Opnshelf"}
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
				item.remote?.mediaId === null &&
				item.remote?.mediaType !== "list" && (
					<View className="gap-2">
						<Text className="text-foreground text-sm">
							Find the matching title
						</Text>
						<TextInput
							accessibilityLabel="Find the matching title"
							className="rounded-xl border border-border bg-background px-3 py-3 text-foreground"
							value={search}
							onChangeText={setSearch}
							placeholder={item.remote.title}
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
											? `Link the existing Opnshelf and ${name} Watches as one viewing. This step keeps both dates. If they differ, you’ll next choose which watch date to keep. Future changes follow your sync settings.`
											: "Link these records?"
										: choice.action === "match"
											? item.kind === "watch"
												? `Use this title for this ${name} media identity and its Watch dates?`
												: `Use this title for this ${name} item?`
											: integrationResolutionLabel(
													choice.action,
													Boolean(item[choice.action as "remote" | "opnshelf"]),
													name,
												)}
								</Text>
								{choice.confirmedRemoteMissing !== undefined && (
									<View className="gap-3">
										<Text className={copy}>
											{integrationUnconfirmedChoiceCopy(name)}
										</Text>
										<Toggle
											label={integrationMissingConfirmation(name)}
											value={choice.confirmedRemoteMissing}
											onChange={(confirmedRemoteMissing) =>
												setChoice({ ...choice, confirmedRemoteMissing })
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
										mutation.isPending ||
										choice.confirmedRemoteMissing === false
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

function useWriteGrant(
	integration: IntegrationDefinition,
	action: "connect" | "disconnect",
) {
	const { runAuthorizationUrl } = useAuth();
	return useMutation({
		mutationKey: [...integrationKey(integration), "write-access", action],
		mutationFn: async () => {
			if (!integration.writeGrant) return;
			// Handoff code (ADR 0026): the callback returns a single-use code.
			const codeChallenge = (await beginHandoff()) ?? undefined;
			const result = await authControllerPermissions({
				body: {
					integration: integration.writeGrant,
					action,
					platform: "mobile",
					codeChallenge,
				},
				throwOnError: true,
			});
			await runAuthorizationUrl(result.data.authorizationUrl);
		},
	});
}

/** External Integration Access (ADR 0030), asked for before the first write. */
function WriteGrant({ integration }: { integration: IntegrationDefinition }) {
	const grant = useWriteGrant(integration, "connect");
	return (
		<View className="gap-3 rounded-xl border border-border bg-background-subtle p-4">
			<Text className="text-foreground text-sm leading-5">
				{integrationWriteGrantCopy(integration.name)}
			</Text>
			<Action
				primary
				label={
					grant.isPending
						? "Opening your account…"
						: `Allow ${integration.name} access`
				}
				disabled={grant.isPending}
				onPress={() => grant.mutate()}
			/>
			{grant.error && (
				<Text
					selectable
					accessibilityRole="alert"
					className="text-destructive text-sm"
				>
					{traktError(grant.error)}
				</Text>
			)}
		</View>
	);
}

function WriteAccess({
	integration,
	removable,
}: {
	integration: IntegrationDefinition;
	removable: boolean;
}) {
	const remove = useWriteGrant(integration, "disconnect");
	return (
		<View className="gap-3 border-border border-t pt-4">
			<Text className={copy}>
				{removable
					? `Opnshelf may write your ${integration.name} records.`
					: `Opnshelf may write your ${integration.name} records. To remove this, first choose ${integration.name} → Opnshelf in Sync settings.`}
			</Text>
			{removable && (
				<Action
					label="Remove access"
					disabled={remove.isPending}
					onPress={() => remove.mutate()}
				/>
			)}
			{remove.error && (
				<Text
					selectable
					accessibilityRole="alert"
					className="text-destructive text-sm"
				>
					{traktError(remove.error)}
				</Text>
			)}
		</View>
	);
}
