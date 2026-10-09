import {
	authControllerPermissions,
	getErrorMessage,
	type PrivacyAction,
	type PrivacyScopeDto,
	privacyErrorMessage,
	usePrivacy,
	usePrivacyProgress,
} from "@opnshelf/api";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useAuth } from "#/lib/auth-context";

const PENDING = "opnshelf-privacy-choice";
export function PrivacySection({
	onboarding = false,
	onContinue,
	listRkey,
}: {
	onboarding?: boolean;
	onContinue?: () => void;
	listRkey?: string;
}) {
	const { user } = useAuth();
	const [confirmation, setConfirmation] = useState<PrivacyAction | null>(null);
	const [manageLists, setManageLists] = useState(false);
	const [listChoice, setListChoice] = useState<"public" | "private" | null>(
		null,
	);
	const resumed = useRef(false);
	const [showProgress, setShowProgress] = useState(false);
	const [showError, setShowError] = useState(false);
	const [declined, setDeclined] = useState(false);
	useEffect(() => {
		setDeclined(
			new URLSearchParams(window.location.search).has("privacyAuthorization"),
		);
	}, []);
	const { query, mutation, pendingKey } = usePrivacy(async (action) => {
		const result = await authControllerPermissions({
			body: { integration: "watches", action: "connect" },
			throwOnError: true,
		});
		sessionStorage.setItem(
			PENDING,
			JSON.stringify({ did: user?.did, action, at: Date.now(), onboarding }),
		);
		window.location.assign(result.data.authorizationUrl);
		return false;
	});
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
		setManageLists(false);
		setShowProgress(false);
		setShowError(true);
	}, [mutation.isError, mutation.error]);

	useEffect(() => {
		if (resumed.current || !query.data || !user) return;
		resumed.current = true;
		// Keep legacy "initial" actions resumable when an older onboarding flow
		// returns from OAuth after the category-first UI has been deployed.
		const stored = sessionStorage.getItem(PENDING);
		sessionStorage.removeItem(PENDING);
		if (
			new URLSearchParams(window.location.search).has("privacyAuthorization")
		) {
			if (stored) {
				try {
					const saved = JSON.parse(stored);
					if (saved.did === user.did && saved.onboarding && !onboarding)
						window.location.assign("/onboarding?privacyAuthorization=declined");
				} catch {
					/* Ignore invalid pending choices. */
				}
			}
			return;
		}
		if (!stored) return;
		try {
			const saved = JSON.parse(stored) as {
				did?: string;
				at?: number;
				action?: PrivacyAction;
			};
			if (
				saved.did === user.did &&
				saved.at &&
				Date.now() - saved.at < 15 * 60 * 1000 &&
				saved.action &&
				query.data.authorized
			) {
				mutation.mutate(saved.action);
			}
		} catch {
			/* Invalid or expired browser state cannot change visibility. */
		}
	}, [query.data, user, mutation.mutate, onboarding]);
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
	useEffect(() => {
		const migrations =
			scopes?.flatMap((scope) =>
				scope.migration ? [scope.migration.id] : [],
			) ?? [];
		if (
			!mutation.isError &&
			migrations.some((id) => !shownMigrations.current.has(id))
		) {
			setManageLists(false);
			setShowProgress(true);
		}
		for (const id of migrations) shownMigrations.current.add(id);
	}, [scopes, mutation.isError]);

	const submit = (action: PrivacyAction) => {
		if (mutation.isPending) return;
		setManageLists(false);
		setShowProgress(true);
		mutation.mutate(action);
	};
	const choose = (action: PrivacyAction) => {
		if (action.body.visibility === "public" && action.kind !== "default") {
			setManageLists(false);
			setConfirmation(action);
		} else {
			submit(action);
		}
	};
	const scopeRow = (scope: PrivacyScopeDto) => {
		const key = `${scope.category}:${scope.listRkey ?? ""}`;
		const moving = scope.migration;
		const label = listRkey
			? "Visibility"
			: scope.category === "watches"
				? "Shelf"
				: scope.label;
		return (
			<div
				key={key}
				className={
					listRkey
						? "space-y-3"
						: "space-y-3 rounded-2xl border border-(--border) bg-(--background-elevated) p-4 sm:p-5"
				}
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<h3 className="font-semibold">{label}</h3>
						{scope.category !== "lists" && (
							<p className="text-(--foreground-muted) text-xs">
								{scope.category === "watches"
									? "Movies & episodes"
									: scope.category === "library"
										? "Your saved collection"
										: "Your personal notes"}
							</p>
						)}
					</div>
					<fieldset
						className="flex w-fit gap-1 rounded-full bg-(--background-subtle) p-1"
						aria-label={listRkey ? "List visibility" : `${label} visibility`}
					>
						{(["public", "private"] as const).map((visibility) => (
							<Button
								key={visibility}
								variant="ghost"
								className={
									scope.visibility === visibility
										? "min-w-20 rounded-full border border-(--accent)/50 bg-(--background-elevated) shadow-sm"
										: "min-w-20 rounded-full border border-transparent"
								}
								aria-pressed={scope.visibility === visibility}
								disabled={
									Boolean(moving) ||
									pendingKey === key ||
									(visibility === "private" &&
										data?.availability !== "available")
								}
								onClick={() =>
									choose({
										kind: "change",
										body: {
											category: scope.category,
											listRkey: scope.listRkey ?? undefined,
											visibility,
										},
									})
								}
							>
								{visibility === "public" ? "Public" : "Private"}
							</Button>
						))}
					</fieldset>
				</div>
				{pendingKey === key && (
					<output className="text-sm">Updating {label}…</output>
				)}
				{moving && (
					<Button
						variant="ghost"
						className="w-fit"
						onClick={() => {
							setManageLists(false);
							setShowProgress(true);
						}}
					>
						View progress
					</Button>
				)}
			</div>
		);
	};
	const progressRow = (scope: PrivacyScopeDto) => {
		const moving = scope.migration;
		if (!moving) return null;
		const key = `${scope.category}:${scope.listRkey ?? ""}`;
		const label = scope.category === "watches" ? "Shelf" : scope.label;
		return (
			<div key={key} className="space-y-2 border-(--border) border-b pb-4">
				<h3 className="font-semibold">{label}</h3>
				{moving && (
					<div aria-live="polite" className="space-y-2 text-sm">
						<p>
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
						</p>
						{moving.status !== "completed" && (
							<p className="text-(--foreground-muted)">
								{scope.category === "lists" &&
									"Records include the List details and its items. "}
								Hidden from others while moving. Edits to {label} pause; you can
								leave this page.
							</p>
						)}
						{moving.error && <p role="alert">{moving.error}</p>}
						{!["queued", "running", "completed"].includes(moving.status) && (
							<Button
								variant="outline"
								disabled={pendingKey === key}
								onClick={() =>
									mutation.mutate({
										kind: "retry",
										body: {
											category: scope.category,
											listRkey: scope.listRkey ?? undefined,
											visibility: moving.target,
										},
									})
								}
							>
								Resume
							</Button>
						)}
					</div>
				)}
			</div>
		);
	};

	return (
		<section
			className={
				listRkey
					? "space-y-3"
					: onboarding
						? "card space-y-3 p-5 sm:p-7"
						: "space-y-3 p-5 sm:p-7"
			}
		>
			{!listRkey && (
				<div className="space-y-3 pb-5">
					<div className="flex flex-wrap items-center gap-3">
						<h2 className="font-semibold text-2xl tracking-tight">
							Who can see your data
						</h2>
						<span className="rounded-md bg-(--accent-subtle) px-2 py-1 font-medium text-xs">
							Alpha
						</span>
					</div>
					<p className="max-w-lg text-(--foreground-muted) text-sm leading-relaxed">
						Public is visible to everyone. Private is for you and the apps you
						authorize.
					</p>
				</div>
			)}
			{declined && (
				<output>
					Private access was not authorized. Your visibility is unchanged.
				</output>
			)}
			{!data ? (
				query.isError ? (
					<div role="alert">
						<p>Could not load Privacy.</p>
						<Button onClick={() => void query.refetch()}>Try again</Button>
						{onboarding && (
							<Button onClick={onContinue}>
								Continue without changing privacy
							</Button>
						)}
					</div>
				) : (
					<div aria-hidden="true" className="space-y-5">
						{(listRkey ? [0] : [0, 1, 2, 3]).map((key) => (
							<div
								key={key}
								className="h-24 animate-pulse rounded-2xl bg-(--border)"
							/>
						))}
					</div>
				)
			) : (
				<>
					{!data.authorized &&
						data.scopes.some(
							(scope) => scope.visibility === "private" || scope.migration,
						) && (
							<output>
								This session cannot access your private content. Choose Private
								again on a category to authorize access. Visibility stays
								unchanged.
							</output>
						)}
					{data.availability !== "available" && (
						<p className="mb-5 text-sm">
							{data.availability === "unsupported"
								? "Your PDS does not support Spaces yet. You can keep using Public."
								: "We could not check Spaces support. Try again before choosing Private."}
						</p>
					)}

					{listRkey
						? scopes?.map(scopeRow)
						: data.scopes
								.filter((scope) => scope.category !== "lists")
								.map(scopeRow)}
					{!listRkey && (
						<div className="space-y-3 rounded-2xl border border-(--border) bg-(--background-elevated) p-4 sm:p-5">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div className="space-y-1">
									<h3 className="font-semibold">Lists</h3>
									<p className="text-(--foreground-muted) text-xs">
										Default for new Lists.
									</p>
								</div>
								<fieldset
									aria-label="Lists visibility"
									className="flex w-fit gap-1 rounded-full bg-(--background-subtle) p-1"
								>
									{(["public", "private"] as const).map((visibility) => (
										<Button
											key={visibility}
											variant="ghost"
											className={
												data.listsDefaultVisibility === visibility
													? "min-w-20 rounded-full border border-(--accent)/50 bg-(--background-elevated) shadow-sm"
													: "min-w-20 rounded-full border border-transparent"
											}
											aria-pressed={data.listsDefaultVisibility === visibility}
											disabled={
												pendingKey === "default" ||
												pendingKey === "allLists" ||
												(visibility === "private" &&
													data.availability !== "available")
											}
											onClick={() => setListChoice(visibility)}
										>
											{visibility === "public" ? "Public" : "Private"}
										</Button>
									))}
								</fieldset>
							</div>
							{(pendingKey === "default" || pendingKey === "allLists") && (
								<output>Updating Lists…</output>
							)}
							<div className="border-(--border) border-t pt-3">
								<Button
									className="-ml-3"
									variant="ghost"
									onClick={() => setManageLists(true)}
								>
									Manage individual Lists
								</Button>
								{data.scopes.some(
									(scope) => scope.category === "lists" && scope.migration,
								) && (
									<Button variant="ghost" onClick={() => setShowProgress(true)}>
										View List progress
									</Button>
								)}
							</div>
						</div>
					)}
					{onboarding && (
						<Button
							disabled={
								mutation.isPending ||
								data.scopes.some((scope) => scope.migration)
							}
							className="btn btn-primary mt-4 w-full"
							onClick={onContinue}
						>
							Continue
						</Button>
					)}
				</>
			)}
			<Dialog open={showError} onOpenChange={setShowError}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Could not change privacy</DialogTitle>
						<DialogDescription>{errorMessage}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button onClick={() => setShowError(false)}>OK</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Dialog open={showProgress} onOpenChange={setShowProgress}>
				<DialogContent className="max-h-[85dvh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Privacy change progress</DialogTitle>
						<DialogDescription>
							{changing
								? "You can close this dialog while your visibility changes continue."
								: "Privacy changes complete."}
						</DialogDescription>
					</DialogHeader>
					{mutation.isPending && (
						<output className="block space-y-3">
							<p>Checking your privacy change…</p>
							<div className="h-20 animate-pulse rounded-xl bg-(--background-subtle)" />
						</output>
					)}
					{progressScopes.map(progressRow)}
					{!changing && (
						<DialogFooter>
							<Button onClick={() => setShowProgress(false)}>Done</Button>
						</DialogFooter>
					)}
				</DialogContent>
			</Dialog>
			<Dialog open={manageLists} onOpenChange={setManageLists}>
				<DialogContent className="max-h-[85dvh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Your Lists</DialogTitle>
						<DialogDescription>
							Choose visibility for each List.
						</DialogDescription>
					</DialogHeader>
					{data?.scopes
						.filter((scope) => scope.category === "lists")
						.map(scopeRow)}
					{!data?.scopes.some((scope) => scope.category === "lists") && (
						<p>No Lists yet.</p>
					)}
				</DialogContent>
			</Dialog>
			<Dialog
				open={listChoice !== null}
				onOpenChange={(open) => {
					if (!open) setListChoice(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Make Lists {listChoice === "private" ? "Private" : "Public"}?
						</DialogTitle>
						<DialogDescription>
							Use this choice for new Lists only, or also change all your
							existing Lists. Individual Lists can be changed separately.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:flex-col-reverse sm:items-stretch">
						<Button variant="ghost" onClick={() => setListChoice(null)}>
							Cancel
						</Button>
						<Button
							variant="ghost"
							className="btn btn-secondary"
							onClick={() => {
								if (listChoice)
									choose({
										kind: "default",
										body: { category: "lists", visibility: listChoice },
									});
								setListChoice(null);
							}}
						>
							New Lists only
						</Button>
						<Button
							disabled={data?.scopes.some(
								(scope) =>
									scope.category === "lists" && Boolean(scope.migration),
							)}
							onClick={() => {
								if (listChoice)
									choose({
										kind: "allLists",
										body: { category: "lists", visibility: listChoice },
									});
								setListChoice(null);
							}}
						>
							All Lists
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={confirmation !== null}
				onOpenChange={(open) => {
					if (!open) setConfirmation(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Make this data Public?</DialogTitle>
						<DialogDescription>
							Existing records will be published and can be copied by other
							services. Making them Private later cannot recall those copies.
							Other public content may still reveal related information.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmation(null)}>
							Cancel
						</Button>
						<Button
							onClick={() => {
								if (confirmation)
									submit({
										...confirmation,
										body: { ...confirmation.body, publicationConfirmed: true },
									});
								setConfirmation(null);
							}}
						>
							Publish
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
