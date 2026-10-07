import {
	authControllerPermissions,
	type PrivacyAction,
	type PrivacyScopeDto,
	usePrivacy,
} from "@opnshelf/api";
import { useState } from "react";
import { View } from "react-native";
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
	const [initial, setInitial] = useState<"public" | "private">("public");
	const [customize, setCustomize] = useState(false);
	const [details, setDetails] = useState(false);
	const [bulk, setBulk] = useState(false);
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
		return runAuthorizationUrl(result.data.authorizationUrl);
	});
	const data = query.data;
	const choose = (action: PrivacyAction) => {
		if (action.body.visibility !== "public" || action.kind === "default") {
			mutation.mutate(action);
			return;
		}
		showDialog({
			title: "Make this data Public?",
			description:
				"Existing records will be published and can be copied by other services. Making them Private later cannot recall those copies. Other public content may still reveal related information.",
			actions: [
				{ label: "Cancel" },
				{
					label: "Publish",
					onPress: () =>
						mutation.mutate({
							...action,
							body: { ...action.body, publicationConfirmed: true },
						}),
				},
			],
		});
	};
	const row = (scope: PrivacyScopeDto) => {
		const key = `${scope.category}:${scope.listRkey ?? ""}`;
		const moving = scope.migration;
		return (
			<View
				key={key}
				className="gap-3 rounded-2xl border border-border bg-background-elevated p-4"
			>
				<View className="flex-row flex-wrap items-center justify-between gap-3">
					<View className="min-w-24 flex-1 gap-1">
						<Text className="font-semibold text-foreground">{scope.label}</Text>
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
					<Text accessibilityLiveRegion="polite">Updating {scope.label}…</Text>
				)}
				{moving && (
					<View className="gap-2">
						<Text>
							Changing to {moving.target === "private" ? "Private" : "Public"} ·{" "}
							{moving.copied} copied
						</Text>
						<Text className="text-muted-foreground text-sm">
							Hidden from others while moving. Edits to {scope.label} pause; you
							can leave this page.
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
		<View className="gap-4">
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
				<Button
					variant="secondary"
					size="sm"
					className="self-start border-transparent px-0"
					onPress={() => setDetails(!details)}
					accessibilityState={{ expanded: details }}
					label={details ? "Hide privacy details" : "Learn more"}
				/>
			</View>
			{details && (
				<Text className="text-muted-foreground text-sm">
					Reviews and Ratings keep their current visibility. Other public
					content may still reveal related information. {data?.alphaDetails}{" "}
					Your PDS can read private data; Spaces are not encrypted end to end.
				</Text>
			)}
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
					{onboarding &&
					!customize &&
					!data.scopes.some(
						(scope) => scope.visibility === "private" || scope.migration,
					) &&
					data.listsDefaultVisibility === "public" ? (
						<View className="gap-4">
							<View className="flex-row gap-2">
								{(["public", "private"] as const).map((choice) => (
									<Button
										key={choice}
										variant={initial === choice ? "primary" : "secondary"}
										accessibilityState={{ selected: initial === choice }}
										disabled={
											choice === "private" && data.availability !== "available"
										}
										onPress={() => setInitial(choice)}
										label={choice === "public" ? "Public" : "Private"}
									/>
								))}
							</View>
							<Button
								variant="secondary"
								onPress={() => setCustomize(true)}
								label="Customize by category"
							/>
							<Button
								disabled={mutation.isPending}
								onPress={() => {
									if (initial === "public") onContinue?.();
									else {
										setCustomize(true);
										mutation.mutate({
											kind: "initial",
											body: { category: "watches", visibility: initial },
										});
									}
								}}
								label="Continue"
							/>
						</View>
					) : (
						<>
							{data.scopes
								.filter((scope) => scope.category !== "lists")
								.map(row)}
							<View className="gap-3 rounded-2xl border border-border bg-background-elevated p-4">
								<Text className="font-semibold text-foreground">New Lists</Text>
								<Text className="text-muted-foreground text-sm">
									Default for Lists you create next.
								</Text>
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
												(visibility === "private" &&
													data.availability !== "available")
											}
											onPress={() =>
												choose({
													kind: "default",
													body: { category: "lists", visibility },
												})
											}
											label={visibility === "public" ? "Public" : "Private"}
										/>
									))}
								</View>
							</View>
							<View className="gap-3 pt-3">
								<View className="flex-row items-center justify-between">
									<Text className="font-semibold text-foreground text-lg">
										Your Lists
									</Text>
									<Button
										variant="secondary"
										size="sm"
										className="border-transparent"
										label="Change all Lists"
										onPress={() => setBulk(!bulk)}
										accessibilityState={{ expanded: bulk }}
									/>
								</View>
								{bulk &&
									(["public", "private"] as const).map((visibility) => (
										<Button
											key={visibility}
											variant="secondary"
											disabled={
												pendingKey === "allLists" ||
												data.scopes.some(
													(scope) =>
														scope.category === "lists" && scope.migration,
												) ||
												(visibility === "private" &&
													data.availability !== "available")
											}
											onPress={() =>
												choose({
													kind: "allLists",
													body: { category: "lists", visibility },
												})
											}
											label={
												"Change all Lists to " +
												(visibility === "public" ? "Public" : "Private")
											}
										/>
									))}
								{data.scopes
									.filter((scope) => scope.category === "lists")
									.map(row)}
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
				</>
			)}
			{mutation.isError && (
				<Text accessibilityRole="alert">
					{mutation.error instanceof Error
						? mutation.error.message
						: "Could not complete this change. Try again."}
				</Text>
			)}
		</View>
	);
}
