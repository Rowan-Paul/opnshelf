import {
	authControllerPermissions,
	getErrorMessage,
	type PrivacyAction,
	type PrivacyScopeDto,
	privacyErrorMessage,
	usePrivacy,
	usePrivacyProgress,
} from "@opnshelf/api";
import { ChevronDown, Globe, Lock, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { beginHandoff } from "@/lib/auth-handoff";

export function PrivacySection({
	onboarding = false,
	onContinue,
	listRkey,
}: {
	onboarding?: boolean;
	onContinue?: () => void;
	listRkey?: string;
}) {
	const { runAuthorizationUrl } = useAuth();
	const { showDialog } = useDialog();
	const [sheet, setSheet] = useState<"lists" | "progress" | null>(null);
	const currentSheet = useRef(sheet);
	useEffect(() => {
		currentSheet.current = sheet;
	}, [sheet]);
	// A hidden iOS sheet remains presented until its native dismissal completes.
	const sheetPresented = useRef(false);
	const setManageLists = useCallback((visible: boolean) => {
		if (visible) sheetPresented.current = true;
		setSheet(visible ? "lists" : null);
	}, []);
	const afterSheetDismiss = useRef<(() => void) | undefined>(undefined);
	const sheetDidDismiss = useCallback(() => {
		sheetPresented.current = false;
		const callback = afterSheetDismiss.current;
		afterSheetDismiss.current = undefined;
		callback?.();
	}, []);
	const afterClosingSheet = useCallback(
		(callback: () => void) => {
			if (!sheetPresented.current) {
				callback();
				return;
			}
			afterSheetDismiss.current = callback;
			setManageLists(false);
			if (Platform.OS !== "ios") sheetDidDismiss();
		},
		[sheetDidDismiss, setManageLists],
	);

	const { query, mutation, pendingKey } = usePrivacy(async () => {
		const codeChallenge = (await beginHandoff()) ?? undefined;
		const result = await authControllerPermissions({
			body: {
				integration: "watches",
				action: "connect",
				platform: "mobile",
				codeChallenge,
			},
			throwOnError: true,
		});
		// ASWebAuthenticationSession must not compete with an animating native sheet.
		await new Promise<void>((resolve) => afterClosingSheet(resolve));
		return runAuthorizationUrl(result.data.authorizationUrl);
	});
	const data = query.data;
	const scopes = useMemo(
		() =>
			data?.scopes.filter((scope) => !listRkey || scope.listRkey === listRkey),
		[data?.scopes, listRkey],
	);
	const progressScopes = usePrivacyProgress(scopes, mutation.isPending);
	const changing = Boolean(
		mutation.isPending || scopes?.some((scope) => scope.migration),
	);
	const shownMigrations = useRef(new Set<string>());
	const openProgress = useCallback(() => {
		if (currentSheet.current === "progress") return;
		afterClosingSheet(() => {
			sheetPresented.current = true;
			setSheet("progress");
		});
	}, [afterClosingSheet]);
	useEffect(() => {
		const migrations =
			scopes?.flatMap((scope) =>
				scope.migration ? [scope.migration.id] : [],
			) ?? [];
		if (
			!mutation.isError &&
			migrations.some((id) => !shownMigrations.current.has(id))
		)
			openProgress();
		for (const id of migrations) shownMigrations.current.add(id);
	}, [scopes, mutation.isError, openProgress]);

	const errorMessage = privacyErrorMessage(
		mutation.error,
		getErrorMessage(
			mutation.error,
			"Could not complete this change. Try again.",
		),
	);
	const shownError = useRef<unknown>(null);
	useEffect(() => {
		if (!mutation.isError) {
			shownError.current = null;
			return;
		}
		if (shownError.current === mutation.error) return;
		shownError.current = mutation.error;
		afterClosingSheet(() =>
			showDialog({
				title: "Could not change privacy",
				description: errorMessage,
				actions: [{ label: "OK" }],
			}),
		);
	}, [
		mutation.isError,
		mutation.error,
		errorMessage,
		showDialog,
		afterClosingSheet,
	]);

	const submit = (action: PrivacyAction) => {
		if (mutation.isPending) return;
		openProgress();
		mutation.mutate(action);
	};
	const choose = (action: PrivacyAction) => {
		if (action.body.visibility !== "public" || action.kind === "default") {
			submit(action);
			return;
		}
		afterClosingSheet(() =>
			showDialog({
				title: "Make this data Public?",
				description:
					"Existing records will be published and can be copied by other services. Making them Private later cannot recall those copies. Other public content may still reveal related information.",
				actions: [
					{ label: "Cancel" },
					{
						label: "Publish",
						variant: "default",
						onDismiss: () => {
							submit({
								...action,
								body: { ...action.body, publicationConfirmed: true },
							});
						},
					},
				],
			}),
		);
	};
	const chooseListVisibility = () => {
		const scope = scopes?.[0];
		if (!scope) return;
		const visibility = scope.visibility === "public" ? "private" : "public";
		const canChange =
			visibility === "public" || data?.availability === "available";
		showDialog({
			title: "List visibility",
			description: `This List is ${scope.visibility === "public" ? "Public" : "Private"}. Public is visible to everyone. Private is for you and the apps you authorize.${canChange ? "" : " Private visibility is currently unavailable on your PDS."}`,
			actions: [
				{ label: "Cancel" },
				...(canChange
					? [
							{
								label: visibility === "public" ? "Make Public" : "Make Private",
								variant: "default" as const,
								onDismiss: () =>
									choose({
										kind: "change",
										body: { category: "lists", listRkey, visibility },
									}),
							},
						]
					: []),
			],
		});
	};

	const chooseLists = (visibility: "public" | "private") => {
		const actions: Parameters<typeof showDialog>[0]["actions"] = [
			{ label: "Cancel" },
			{
				label: "New Lists only",
				variant: "ghost",
				onDismiss: () =>
					choose({
						kind: "default",
						body: { category: "lists" as const, visibility },
					}),
			},
		];
		if (
			!data?.scopes.some(
				(scope) => scope.category === "lists" && scope.migration,
			)
		)
			actions.push({
				label: "All Lists",
				variant: "default",
				onDismiss: () =>
					choose({ kind: "allLists", body: { category: "lists", visibility } }),
			});
		showDialog({
			title: `Make Lists ${visibility === "private" ? "Private" : "Public"}?`,
			description:
				"Use this choice for new Lists only, or also change all your existing Lists. Individual Lists can be changed separately.",
			actions,
		});
	};

	const row = (scope: PrivacyScopeDto) => {
		const key = `${scope.category}:${scope.listRkey ?? ""}`;
		const moving = scope.migration;
		const label = listRkey
			? "Visibility"
			: scope.category === "watches"
				? "Shelf"
				: scope.label;
		return (
			<View
				key={key}
				className={
					listRkey
						? "gap-3"
						: "gap-3 rounded-2xl border border-border bg-background-elevated p-4"
				}
			>
				<View className="flex-row flex-wrap items-center justify-between gap-3">
					{!listRkey && (
						<View className="min-w-24 flex-1 gap-1">
							{!listRkey && (
								<Text className="font-semibold text-foreground">{label}</Text>
							)}
							{scope.category !== "lists" && (
								<Text className="text-muted-foreground text-xs">
									{scope.category === "watches"
										? "Movies & episodes"
										: scope.category === "library"
											? "Your saved collection"
											: "Your personal notes"}
								</Text>
							)}
						</View>
					)}
					<View className="flex-row gap-1 rounded-full bg-background-subtle p-1">
						{(["public", "private"] as const).map((visibility) => (
							<Button
								key={visibility}
								variant="secondary"
								size="sm"
								className={
									scope.visibility === visibility
										? "h-11 border-primary/50 bg-background-elevated"
										: "h-11 border-transparent"
								}
								accessibilityState={{
									selected: scope.visibility === visibility,
								}}
								disabled={
									Boolean(moving) ||
									pendingKey === key ||
									(visibility === "private" &&
										data?.availability !== "available")
								}
								onPress={() =>
									choose({
										kind: "change",
										body: {
											category: scope.category,
											listRkey: scope.listRkey ?? undefined,
											visibility,
										},
									})
								}
								label={visibility === "public" ? "Public" : "Private"}
							/>
						))}
					</View>
				</View>
				{pendingKey === key && (
					<Text accessibilityLiveRegion="polite">Updating {label}…</Text>
				)}
				{moving && (
					<Button
						variant="secondary"
						className="self-start"
						label="View progress"
						onPress={openProgress}
					/>
				)}
			</View>
		);
	};
	const progressRow = (scope: PrivacyScopeDto) => {
		const moving = scope.migration;
		if (!moving) return null;
		const key = `${scope.category}:${scope.listRkey ?? ""}`;
		const label = scope.category === "watches" ? "Shelf" : scope.label;
		return (
			<View key={key} className="gap-2 border-border border-b pb-4">
				<Text className="font-semibold text-foreground">{label}</Text>
				{moving && (
					<View className="gap-2">
						<Text>
							{moving.status === "completed" ? "Changed to" : "Changing to"}{" "}
							{moving.target === "private" ? "Private" : "Public"} ·{" "}
							{moving.total == null
								? `${moving.copied}/… records copied · Counting records…`
								: `${moving.copied}/${moving.total} records copied`}
							{moving.status !== "completed" &&
								moving.total != null &&
								moving.copied >= moving.total &&
								["queued", "running"].includes(moving.status) &&
								" · Finishing…"}
						</Text>
						{moving.status !== "completed" && (
							<Text className="text-muted-foreground text-sm">
								{scope.category === "lists" &&
									"Records include the List details and its items. "}
								Hidden from others while moving. Edits to {label} pause; you can
								leave this page.
							</Text>
						)}
						{moving.error && (
							<Text accessibilityRole="alert">{moving.error}</Text>
						)}
						{!["queued", "running", "completed"].includes(moving.status) && (
							<Button
								variant="secondary"
								disabled={pendingKey === key}
								onPress={() =>
									mutation.mutate({
										kind: "retry",
										body: {
											category: scope.category,
											listRkey: scope.listRkey ?? undefined,
											visibility: moving.target,
										},
									})
								}
								label="Resume"
							/>
						)}
					</View>
				)}
			</View>
		);
	};

	return (
		<View
			className={
				listRkey
					? "self-start"
					: onboarding
						? "gap-4 rounded-xl border border-border bg-card p-5"
						: "gap-4"
			}
		>
			{!listRkey && (
				<View className="gap-3 pb-2">
					<View className="flex-row flex-wrap items-center gap-3">
						<Text className="font-semibold text-2xl text-foreground">
							Who can see your data
						</Text>
						<View className="rounded-md bg-primary/10 px-2 py-1">
							<Text className="font-semibold text-foreground text-xs">
								Alpha
							</Text>
						</View>
					</View>
					<Text className="text-muted-foreground text-sm leading-5">
						Public is visible to everyone. Private is for you and the apps you
						authorize.
					</Text>
				</View>
			)}
			{listRkey ? (
				!data ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Retry loading List visibility"
						disabled={!query.isError}
						onPress={() => void query.refetch()}
					>
						{query.isError ? (
							<Text className="text-muted-foreground text-xs">
								Retry visibility
							</Text>
						) : (
							<View className="h-4 w-20 rounded bg-background-subtle" />
						)}
					</Pressable>
				) : (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={`List visibility: ${scopes?.[0]?.visibility === "private" ? "Private" : "Public"}. Change visibility`}
						hitSlop={12}
						className="flex-row items-center gap-1.5"
						onPress={() => (changing ? openProgress() : chooseListVisibility())}
					>
						{scopes?.[0]?.visibility === "private" ? (
							<Lock size={13} color="#64748b" />
						) : (
							<Globe size={13} color="#64748b" />
						)}
						<Text className="text-muted-foreground text-xs">
							{changing
								? "Changing visibility…"
								: scopes?.[0]?.visibility === "private"
									? "Private"
									: "Public"}
						</Text>
						<ChevronDown size={12} color="#64748b" />
					</Pressable>
				)
			) : !data ? (
				query.isError ? (
					<View>
						<Text>Could not load Privacy.</Text>
						<Button onPress={() => void query.refetch()} label="Try again" />
						{onboarding && (
							<Button
								onPress={onContinue}
								label="Continue without changing privacy"
							/>
						)}
					</View>
				) : (
					<View className="gap-5">
						{(listRkey ? [0] : [0, 1, 2, 3]).map((key) => (
							<View
								key={key}
								className="h-24 rounded-2xl bg-background-subtle"
							/>
						))}
					</View>
				)
			) : (
				<>
					{!data.authorized &&
						data.scopes.some(
							(scope) => scope.visibility === "private" || scope.migration,
						) && (
							<Text>
								This session cannot access your private content. Choose Private
								again on a category to authorize access. Visibility stays
								unchanged.
							</Text>
						)}
					{data.availability !== "available" && (
						<Text className="text-muted-foreground text-sm">
							{data.availability === "unsupported"
								? "Your PDS does not support Spaces yet. You can keep using Public."
								: "We could not check Spaces support. Try again before choosing Private."}
						</Text>
					)}

					{listRkey
						? scopes?.map(row)
						: data.scopes
								.filter((scope) => scope.category !== "lists")
								.map(row)}
					{!listRkey && (
						<View className="gap-3 rounded-2xl border border-border bg-background-elevated p-4">
							<View className="flex-row flex-wrap items-center justify-between gap-3">
								<View className="min-w-24 flex-1 gap-1">
									<Text className="font-semibold text-foreground">Lists</Text>
									<Text className="text-muted-foreground text-xs">
										Default for new Lists.
									</Text>
								</View>
								<View className="flex-row gap-1 self-start rounded-full bg-background-subtle p-1">
									{(["public", "private"] as const).map((visibility) => (
										<Button
											key={visibility}
											variant="secondary"
											size="sm"
											className={
												data.listsDefaultVisibility === visibility
													? "h-11 border-primary/50 bg-background-elevated"
													: "h-11 border-transparent"
											}
											accessibilityState={{
												selected: data.listsDefaultVisibility === visibility,
											}}
											disabled={
												pendingKey === "default" ||
												pendingKey === "allLists" ||
												(visibility === "private" &&
													data.availability !== "available")
											}
											onPress={() => chooseLists(visibility)}
											accessibilityLabel={`Lists ${visibility}`}
											label={visibility === "public" ? "Public" : "Private"}
										/>
									))}
								</View>
							</View>
							<View className="gap-3 border-border border-t pt-3">
								<Button
									className="self-start border-transparent px-0"
									variant="secondary"
									label="Manage individual Lists"
									onPress={() => setManageLists(true)}
								/>
								{data.scopes.some(
									(scope) => scope.category === "lists" && scope.migration,
								) && (
									<Button
										variant="secondary"
										label="View List progress"
										onPress={openProgress}
									/>
								)}
							</View>
						</View>
					)}
					{onboarding && (
						<Button
							disabled={
								mutation.isPending ||
								data.scopes.some((scope) => scope.migration)
							}
							onPress={onContinue}
							label="Continue"
						/>
					)}
				</>
			)}

			<Modal
				visible={sheet !== null}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setManageLists(false)}
				onDismiss={sheetDidDismiss}
			>
				<View className="flex-1 bg-background">
					<SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
						<View className="flex-row items-center justify-between p-5">
							<Text className="flex-1 font-semibold text-xl">
								{sheet === "progress"
									? "Privacy change progress"
									: listRkey
										? "List visibility"
										: "Your Lists"}
							</Text>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="Close dialog"
								onPress={() => setManageLists(false)}
								className="h-11 w-11 items-center justify-center rounded-full bg-background-subtle"
							>
								<X size={22} color="#64748b" />
							</Pressable>
						</View>
						<ScrollView
							style={{ flex: 1 }}
							contentContainerStyle={{ padding: 20, gap: 12 }}
						>
							{sheet === "progress" ? (
								<>
									{changing && (
										<Text className="text-muted-foreground">
											You can close this dialog while your visibility changes
											continue.
										</Text>
									)}
									{mutation.isPending && (
										<View className="gap-3" accessibilityLiveRegion="polite">
											<Text>Checking your privacy change…</Text>
											<View className="h-20 rounded-xl bg-background-subtle" />
										</View>
									)}
									{progressScopes.map(progressRow)}
									{!changing && <Text>Privacy changes complete.</Text>}
								</>
							) : (
								<>
									<Text className="text-muted-foreground">
										{listRkey
											? "Public is visible to everyone. Private is for you and the apps you authorize."
											: "Choose visibility for each List."}
									</Text>
									{scopes
										?.filter((scope) => scope.category === "lists")
										.map(row)}
									{!data?.scopes.some(
										(scope) => scope.category === "lists",
									) && <Text>No Lists yet.</Text>}
								</>
							)}
						</ScrollView>
						{sheet === "progress" && !changing && (
							<View className="p-5">
								<Button label="Done" onPress={() => setManageLists(false)} />
							</View>
						)}
					</SafeAreaView>
				</View>
			</Modal>
		</View>
	);
}
