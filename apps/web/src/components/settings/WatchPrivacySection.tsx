import {
	watchPrivacyControllerChangeMutation,
	watchPrivacyControllerRetryMutation,
	watchPrivacyControllerStatusOptions,
	watchPrivacyControllerSyncMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { usePermissionChange } from "./use-settings-mutations";

export function WatchPrivacySection() {
	const client = useQueryClient();
	const state = useQuery({
		...watchPrivacyControllerStatusOptions(),
		refetchInterval: (query) => (query.state.data?.migration ? 2000 : 30000),
	});
	const permissions = usePermissionChange();
	const [confirm, setConfirm] = useState<
		"public" | "private" | "connect" | "disconnect" | null
	>(null);
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
		change.isPending ||
		retry.isPending ||
		sync.isPending ||
		permissions.isPending;
	const migration = data?.migration;
	return (
		<section
			id="watch-privacy"
			className="scroll-mt-24 border-(--border) border-b p-5 sm:p-7"
		>
			<h2 className="mb-1 font-semibold text-lg">Watch privacy</h2>
			<p className="mb-5 max-w-lg text-(--foreground-muted) text-sm">
				Choose who can see your movie and episode Watches. Reviews, Ratings,
				Lists, Library and Notes keep their current visibility.
			</p>
			{!data ? (
				state.isError ? (
					<div role="alert">
						<p>Could not load Watch privacy.</p>
						<Button variant="outline" onClick={() => void state.refetch()}>
							Try again
						</Button>
					</div>
				) : (
					<div aria-hidden="true" className="max-w-lg animate-pulse space-y-3">
						<div className="h-6 w-36 rounded bg-(--border)" />
						<div className="h-10 w-full rounded bg-(--border)" />
					</div>
				)
			) : (
				<div className="max-w-lg space-y-3">
					<p className="font-medium">
						{migration
							? "Watches hidden while privacy changes"
							: `Watches are ${data.visibility === "private" ? "Private" : "Public"}`}
					</p>
					<p className="text-(--foreground-muted) text-sm">
						Private Watches are available to you and apps you authorize. Your
						PDS can access them; Spaces are not encrypted end to end.
					</p>
					{migration ? (
						<div aria-live="polite" className="space-y-2">
							<p>
								Changing to{" "}
								{migration.target === "private" ? "Private" : "Public"} ·{" "}
								{migration.copied} copied
							</p>
							<p className="text-sm">
								Logging, editing and imports pause until this finishes. You can
								leave this page.
							</p>
							{migration.error && <p role="alert">{migration.error}</p>}
							{!["queued", "running"].includes(migration.status) && (
								<Button
									disabled={busy || !data.connected}
									onClick={() => retry.mutate({})}
								>
									{retry.isPending ? "Resuming…" : "Resume privacy change"}
								</Button>
							)}
						</div>
					) : (
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								disabled={
									busy || !data.connected || data.visibility === "public"
								}
								onClick={() => setConfirm("public")}
							>
								Make Public
							</Button>
							<Button
								disabled={
									busy || !data.connected || data.visibility === "private"
								}
								onClick={() => setConfirm("private")}
							>
								Make Private
							</Button>
						</div>
					)}
					{!data.connected && (
						<Button
							variant="outline"
							disabled={busy}
							onClick={() => setConfirm("connect")}
						>
							Connect Watch access
						</Button>
					)}
					{!data.connected && data.visibility === "private" && (
						<p aria-live="polite" className="text-sm">
							Your Watches remain Private. Reconnect Watch access to log, edit
							or sync Watches.
						</p>
					)}
					{data.connected && data.visibility === "public" && !migration && (
						<Button
							variant="ghost"
							disabled={busy}
							onClick={() => setConfirm("disconnect")}
						>
							Disconnect Watch access
						</Button>
					)}
					{data.syncError && (
						<p role="alert" className="text-sm">
							{data.syncError}
						</p>
					)}
					{!migration && data.connected && (
						<Button
							variant="ghost"
							disabled={busy}
							onClick={() => sync.mutate({})}
						>
							{sync.isPending ? "Checking Watches…" : "Sync Watches now"}
						</Button>
					)}
					{error && (
						<p role="alert" className="text-sm">
							{error}
						</p>
					)}
				</div>
			)}
			<Dialog
				open={confirm !== null}
				onOpenChange={(open) => {
					if (!open) setConfirm(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{confirm === "disconnect"
								? "Disconnect Watch access?"
								: confirm === "connect"
									? "Connect Watch access?"
									: `Make Watches ${confirm === "private" ? "Private" : "Public"}?`}
						</DialogTitle>
						<DialogDescription>
							{confirm === "disconnect"
								? "Remove Opnshelf’s private Watch Space permission. Your Watches stay Public. Other devices will need to sign in again."
								: confirm === "connect"
									? "Authorize access to your private Watch Space. Other devices will need to sign in again. Connecting does not change visibility."
									: confirm === "private"
										? "Your Watches will be copied to your private Space and removed from your public repository. Copies already held by other services cannot be recalled. Logging and editing pause while the change runs."
										: "All your Watches will be published to your public repository and can be copied by other services. This cannot recall any published copies if you later make Watches private. Logging and editing pause while the change runs."}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirm(null)}>
							Cancel
						</Button>
						<Button
							onClick={() => {
								const target = confirm;
								setConfirm(null);
								if (target === "connect" || target === "disconnect")
									permissions.requestPermissionChange("watches", target);
								else if (target)
									change.mutate({
										body: {
											visibility: target,
											publicationConfirmed: target === "public",
										},
									});
							}}
						>
							{confirm === "connect" || confirm === "disconnect"
								? "Continue to authorization"
								: confirm === "public"
									? "Publish all Watches"
									: "Make Watches Private"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
