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
			<View key={key} className="gap-3 border-border border-t py-5">
				<Text className="font-semibold text-foreground">{scope.label}</Text>
				<View className="flex-row gap-2">
					{(["public", "private"] as const).map((visibility) => (
						<Button
							key={visibility}
							variant={
								scope.visibility === visibility ? "primary" : "secondary"
							}
							accessibilityState={{ selected: scope.visibility === visibility }}
							disabled={
								Boolean(moving) ||
								pendingKey === key ||
								(visibility === "private" && data?.availability !== "available")
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
			<Text className="font-semibold text-primary text-xs">Alpha</Text>
			<Text className="text-muted-foreground text-sm">
				Choose who can see your Watches, Library, Notes and Lists. Private data
				is available to you and apps you authorize. Reviews and Ratings keep
				their current visibility. Other public content may still reveal related
				information.
			</Text>
			<Button
				variant="secondary"
				onPress={() => setDetails(!details)}
				label="Learn more"
			/>
			{details && (
				<Text className="text-muted-foreground text-sm">
					{data?.alphaDetails} Your PDS can read private data; Spaces are not
					encrypted end to end.
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
							<View key={key} className="h-16 rounded bg-background-subtle" />
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
							<View className="gap-3 border-border border-t py-5">
								<Text className="font-semibold text-foreground">New Lists</Text>
								<Text className="text-muted-foreground text-sm">
									This default only applies to Lists you create next.
								</Text>
								<View className="flex-row gap-2">
									{(["public", "private"] as const).map((visibility) => (
										<Button
											key={visibility}
											variant={
												data.listsDefaultVisibility === visibility
													? "primary"
													: "secondary"
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
							<View className="gap-3 border-border border-t pt-5">
								<Text className="font-semibold text-foreground">
									Your Lists
								</Text>
								{(["public", "private"] as const).map((visibility) => (
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
