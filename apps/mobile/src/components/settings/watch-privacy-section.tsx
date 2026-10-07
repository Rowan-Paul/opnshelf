import {
	watchPrivacyControllerChangeMutation,
	watchPrivacyControllerRetryMutation,
	watchPrivacyControllerStatusOptions,
	watchPrivacyControllerSyncMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog";

export function WatchPrivacySection({
	permissionPending,
	onConnect,
	onDisconnect,
}: {
	permissionPending: boolean;
	onConnect: () => void;
	onDisconnect: () => void;
}) {
	const client = useQueryClient();
	const { showDialog } = useDialog();
	const state = useQuery({
		...watchPrivacyControllerStatusOptions(),
		refetchInterval: (query) => (query.state.data?.migration ? 2000 : 30000),
	});
	const [error, setError] = useState<string | null>(null);
	const refresh = () => {
		setError(null);
		void client.invalidateQueries();
	};
	const onError = (cause: unknown) => {
		setError(
			cause &&
				typeof cause === "object" &&
				"message" in cause &&
				typeof cause.message === "string"
				? cause.message
				: "Could not change Watch privacy. Check your connection and PDS support, then try again. Your privacy change can be resumed.",
		);
		void state.refetch();
	};
	const change = useMutation({
		...watchPrivacyControllerChangeMutation(),
		onSuccess: refresh,
		onError,
	});
	const retry = useMutation({
		...watchPrivacyControllerRetryMutation(),
		onSuccess: refresh,
		onError,
	});
	const sync = useMutation({
		...watchPrivacyControllerSyncMutation(),
		onSuccess: refresh,
		onError,
	});
	const previous = useRef<string | undefined>(undefined);
	const signature = state.data
		? `${state.data.visibility}:${state.data.migration?.id ?? ""}`
		: undefined;
	useEffect(() => {
		if (previous.current && previous.current !== signature)
			void client.invalidateQueries();
		previous.current = signature;
	}, [signature, client]);
	const data = state.data;
	const busy =
		permissionPending || change.isPending || retry.isPending || sync.isPending;
	const migration = data?.migration;
	const confirm = (target: "public" | "private") =>
		showDialog({
			title: `Make Watches ${target === "private" ? "Private" : "Public"}?`,
			description:
				target === "private"
					? "Your Watches will be copied to your private Space and removed from your public repository. Copies already held by other services cannot be recalled. Logging and editing pause while the change runs."
					: "All your Watches will be published to your public repository and can be copied by other services. This cannot recall any published copies if you later make Watches private. Logging and editing pause while the change runs.",
			actions: [
				{ label: "Cancel" },
				{
					label:
						target === "public"
							? "Publish all Watches"
							: "Make Watches Private",
					onPress: () =>
						change.mutate({
							body: {
								visibility: target,
								publicationConfirmed: target === "public",
							},
						}),
				},
			],
		});
	return (
		<View className="gap-3">
			<Text className="text-muted-foreground text-sm">
				Choose who can see your movie and episode Watches. Reviews, Ratings,
				Lists, Library and Notes keep their current visibility.
			</Text>
			{!data ? (
				state.isError ? (
					<View>
						<Text selectable>Could not load Watch privacy.</Text>
						<Button
							variant="secondary"
							label="Try again"
							onPress={() => void state.refetch()}
						/>
					</View>
				) : (
					<View accessibilityLabel="Loading Watch privacy" className="gap-3">
						<View className="h-6 w-36 rounded bg-muted" />
						<View className="h-10 rounded bg-muted" />
					</View>
				)
			) : (
				<>
					<Text selectable className="font-semibold text-foreground">
						{migration
							? "Watches hidden while privacy changes"
							: `Watches are ${data.visibility === "private" ? "Private" : "Public"}`}
					</Text>
					<Text className="text-muted-foreground text-sm">
						Private Watches are available to you and apps you authorize. Your
						PDS can access them; Spaces are not encrypted end to end.
					</Text>
					{migration ? (
						<View className="gap-2">
							<Text selectable>
								Changing to{" "}
								{migration.target === "private" ? "Private" : "Public"} ·{" "}
								{migration.copied} copied
							</Text>
							<Text>
								Logging, editing and imports pause until this finishes. You can
								leave this page.
							</Text>
							{migration.error && <Text selectable>{migration.error}</Text>}
							{!["queued", "running"].includes(migration.status) && (
								<Button
									disabled={busy || !data.connected}
									label={
										retry.isPending ? "Resuming…" : "Resume privacy change"
									}
									onPress={() => retry.mutate({})}
								/>
							)}
						</View>
					) : (
						<View className="gap-2">
							<Button
								variant="secondary"
								disabled={
									busy || !data.connected || data.visibility === "public"
								}
								label="Make Public"
								onPress={() => confirm("public")}
							/>
							<Button
								disabled={
									busy || !data.connected || data.visibility === "private"
								}
								label="Make Private"
								onPress={() => confirm("private")}
							/>
						</View>
					)}
					{!data.connected && (
						<Button
							variant="secondary"
							label="Connect Watch access"
							disabled={busy}
							onPress={() =>
								showDialog({
									title: "Connect Watch access?",
									description:
										"Authorize access to your private Watch Space. Other devices will need to sign in again. Connecting does not change visibility.",
									actions: [
										{ label: "Cancel" },
										{ label: "Continue to authorization", onPress: onConnect },
									],
								})
							}
						/>
					)}
					{!data.connected && data.visibility === "private" && (
						<Text accessibilityRole="alert">
							Your Watches remain Private. Reconnect Watch access to log, edit
							or sync Watches.
						</Text>
					)}
					{data.connected && data.visibility === "public" && !migration && (
						<Button
							variant="secondary"
							label="Disconnect Watch access"
							disabled={busy}
							onPress={() =>
								showDialog({
									title: "Disconnect Watch access?",
									description:
										"Remove Opnshelf’s private Watch Space permission. Your Watches stay Public. Other devices will need to sign in again.",
									actions: [
										{ label: "Cancel" },
										{
											label: "Continue to authorization",
											onPress: onDisconnect,
										},
									],
								})
							}
						/>
					)}
					{data.syncError && <Text selectable>{data.syncError}</Text>}
					{!migration && data.connected && (
						<Button
							variant="secondary"
							disabled={busy}
							label={sync.isPending ? "Checking Watches…" : "Sync Watches now"}
							onPress={() => sync.mutate({})}
						/>
					)}
					{error && (
						<Text selectable accessibilityRole="alert">
							{error}
						</Text>
					)}
				</>
			)}
		</View>
	);
}
