import {
	authControllerPermissions,
	getErrorMessage,
	type PrivacyAction,
	type PrivacyScopeDto,
	usePrivacy,
} from "@opnshelf/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { beginHandoff } from "@/lib/auth-handoff";

export function PrivacySection({
	onboarding = false,
	onContinue,
}: {
	onboarding?: boolean;
	onContinue?: () => void;
}) {
	const { runAuthorizationUrl } = useAuth();
	const { showDialog } = useDialog();
	const [manageLists, setManageListsVisible] = useState(false);
	// A hidden iOS sheet remains presented until its native dismissal completes.
	const listsPresented = useRef(false);
	const setManageLists = useCallback((visible: boolean) => {
		if (visible) listsPresented.current = true;
		setManageListsVisible(visible);
	}, []);
	const afterListsDismiss = useRef<(() => void) | undefined>(undefined);
	const listsDidDismiss = useCallback(() => {
		listsPresented.current = false;
		const callback = afterListsDismiss.current;
		afterListsDismiss.current = undefined;
		callback?.();
	}, []);
	const afterClosingLists = useCallback(
		(callback: () => void) => {
			if (!listsPresented.current) {
				callback();
				return;
			}
			afterListsDismiss.current = callback;
			setManageLists(false);
			if (Platform.OS !== "ios") listsDidDismiss();
		},
		[listsDidDismiss, setManageLists],
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
		await new Promise<void>((resolve) => afterClosingLists(resolve));
		return runAuthorizationUrl(result.data.authorizationUrl);
	});
	const data = query.data;
	const shownListMigrations = useRef(new Set<string>());
	const bulkListChange = useRef(false);
	useEffect(() => {
		// A partially accepted bulk request can report migrations alongside an error.
		// Let the error dialog remain visible; progress is still available manually.
		const migrations =
			data?.scopes.flatMap((scope) =>
				scope.category === "lists" && scope.migration
					? [scope.migration.id]
					: [],
			) ?? [];
		if (
			!mutation.isError &&
			!bulkListChange.current &&
			migrations.some((id) => !shownListMigrations.current.has(id))
		) {
			setManageLists(true);
		}
		for (const id of migrations) shownListMigrations.current.add(id);
	}, [data?.scopes, mutation.isError, setManageLists]);

	const errorMessage = getErrorMessage(
		mutation.error,
		"Could not complete this change. Try again.",
	);
	const shownError = useRef<unknown>(null);
	useEffect(() => {
		if (!mutation.isError) {
			shownError.current = null;
			return;
		}
		if (shownError.current === mutation.error) return;
		shownError.current = mutation.error;
		afterClosingLists(() =>
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
		afterClosingLists,
	]);

	const submit = (action: PrivacyAction) => {
		if (action.body.category === "lists")
			bulkListChange.current = action.kind === "allLists";
		mutation.mutate(action);
	};
	const choose = (action: PrivacyAction) => {
		if (action.body.visibility !== "public" || action.kind === "default") {
			submit(action);
			return;
		}
		afterClosingLists(() =>
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
		const label = scope.category === "watches" ? "Shelf" : scope.label;
		return (
			<View
				key={key}
				className="gap-3 rounded-2xl border border-border bg-background-elevated p-4"
			>
				<View className="flex-row flex-wrap items-center justify-between gap-3">
					<View className="min-w-24 flex-1 gap-1">
						<Text className="font-semibold text-foreground">{label}</Text>
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
					<View className="gap-2">
						<Text>
							Changing to {moving.target === "private" ? "Private" : "Public"} ·{" "}
							{moving.total == null
								? `${moving.copied} records copied`
								: `${moving.copied}/${moving.total} records copied`}
							{moving.total != null &&
								moving.copied >= moving.total &&
								["queued", "running"].includes(moving.status) &&
								" · Finishing…"}
						</Text>
						<Text className="text-muted-foreground text-sm">
							{scope.category === "lists" &&
								"Records include the List details and its items. "}
							Hidden from others while moving. Edits to {label} pause; you can
							leave this page.
						</Text>
						{moving.error && (
							<Text accessibilityRole="alert">{moving.error}</Text>
						)}
						{!["queued", "running"].includes(moving.status) && (
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
				onboarding
					? "gap-4 rounded-xl border border-border bg-card p-5"
					: "gap-4"
			}
		>
			<View className="gap-3 pb-2">
				<View className="flex-row flex-wrap items-center gap-3">
					<Text className="font-semibold text-2xl text-foreground">
						Who can see your data
					</Text>
					<View className="rounded-md bg-primary/10 px-2 py-1">
						<Text className="font-semibold text-foreground text-xs">Alpha</Text>
					</View>
				</View>
				<Text className="text-muted-foreground text-sm leading-5">
					Public is visible to everyone. Private is for you and the apps you
					authorize.
				</Text>
			</View>
			{!data ? (
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
						{[0, 1, 2, 3].map((key) => (
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

					{data.scopes.filter((scope) => scope.category !== "lists").map(row)}
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
								label={
									bulkListChange.current &&
									data.scopes.some(
										(scope) => scope.category === "lists" && scope.migration,
									)
										? "View List progress"
										: "Manage individual Lists"
								}
								onPress={() => setManageLists(true)}
							/>
						</View>
					</View>
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
			{mutation.isError && (
				<Text accessibilityRole="alert">{errorMessage}</Text>
			)}
			<Modal
				visible={manageLists}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setManageLists(false)}
				onDismiss={listsDidDismiss}
			>
				<SafeAreaView className="flex-1 bg-background">
					<View className="flex-row items-center justify-between p-5">
						<Text className="font-semibold text-xl">Your Lists</Text>
						<Button
							variant="secondary"
							label="Done"
							onPress={() => setManageLists(false)}
						/>
					</View>
					<ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
						<Text className="text-muted-foreground">
							Choose visibility for each List.
						</Text>
						{data?.scopes
							.filter((scope) => scope.category === "lists")
							.map(row)}
						{!data?.scopes.some((scope) => scope.category === "lists") && (
							<Text>No Lists yet.</Text>
						)}
						{mutation.isError && (
							<Text accessibilityRole="alert">{errorMessage}</Text>
						)}
					</ScrollView>
				</SafeAreaView>
			</Modal>
		</View>
	);
}
