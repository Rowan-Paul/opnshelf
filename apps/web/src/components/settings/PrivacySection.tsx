import {
	authControllerPermissions,
	type PrivacyAction,
	type PrivacyScopeDto,
	usePrivacy,
} from "@opnshelf/api";
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
import { useAuth } from "#/lib/auth-context";

const PENDING = "opnshelf-privacy-choice";
export function PrivacySection({
	onboarding = false,
	onContinue,
}: {
	onboarding?: boolean;
	onContinue?: () => void;
}) {
	const { user } = useAuth();
	const [confirmation, setConfirmation] = useState<PrivacyAction | null>(null);
	const [initial, setInitial] = useState<"public" | "private">("public");
	const [customize, setCustomize] = useState(false);
	const resumed = useRef(false);
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
	useEffect(() => {
		if (resumed.current || !query.data || !user) return;
		resumed.current = true;
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
				setCustomize(true);
				mutation.mutate(saved.action);
			}
		} catch {
			/* Invalid or expired browser state cannot change visibility. */
		}
	}, [query.data, user, mutation.mutate, onboarding]);
	const data = query.data;
	const choose = (action: PrivacyAction) => {
		if (action.body.visibility === "public" && action.kind !== "default")
			setConfirmation(action);
		else mutation.mutate(action);
	};
	const scopeRow = (scope: PrivacyScopeDto) => {
		const key = `${scope.category}:${scope.listRkey ?? ""}`;
		const moving = scope.migration;
		return (
			<div
				key={key}
				className="space-y-3 rounded-2xl border border-(--border) bg-(--background-elevated) p-4 sm:p-5"
			>
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="space-y-1">
						<h3 className="font-semibold">{scope.label}</h3>
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
						className="flex gap-1 rounded-full bg-(--background-subtle) p-1"
						aria-label={`${scope.label} visibility`}
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
					<output className="text-sm">Updating {scope.label}…</output>
				)}
				{moving && (
					<div aria-live="polite" className="space-y-2 text-sm">
						<p>
							Changing to {moving.target === "private" ? "Private" : "Public"} ·{" "}
							{moving.copied} copied
						</p>
						<p className="text-(--foreground-muted)">
							Hidden from others while moving. Edits to {scope.label} pause; you
							can leave this page.
						</p>
						{moving.error && <p role="alert">{moving.error}</p>}
						{!["queued", "running"].includes(moving.status) && (
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
		<section className="space-y-3 p-5 sm:p-7">
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
				<details className="text-sm">
					<summary className="w-fit cursor-pointer text-(--foreground-muted) underline-offset-4 hover:text-(--foreground) hover:underline">
						Learn more
					</summary>
					<p className="max-w-xl pt-3 text-(--foreground-muted) leading-relaxed">
						Reviews and Ratings keep their current visibility. Other public
						content may still reveal related information. {data?.alphaDetails}{" "}
						Your PDS can read private data; Spaces are not encrypted end to end.
					</p>
				</details>
			</div>
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
						{[0, 1, 2, 3].map((key) => (
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
					{onboarding &&
					!customize &&
					!data.scopes.some(
						(scope) => scope.visibility === "private" || scope.migration,
					) &&
					data.listsDefaultVisibility === "public" ? (
						<div className="space-y-5">
							<div className="flex gap-3">
								{(["public", "private"] as const).map((choice) => (
									<Button
										key={choice}
										aria-pressed={initial === choice}
										variant={initial === choice ? "default" : "outline"}
										disabled={
											choice === "private" && data.availability !== "available"
										}
										onClick={() => setInitial(choice)}
									>
										{choice === "public" ? "Public" : "Private"}
									</Button>
								))}
							</div>
							<Button variant="ghost" onClick={() => setCustomize(true)}>
								Customize by category
							</Button>
							<Button
								disabled={mutation.isPending}
								onClick={() => {
									if (initial === "public") onContinue?.();
									else {
										setCustomize(true);
										mutation.mutate({
											kind: "initial",
											body: { category: "watches", visibility: initial },
										});
									}
								}}
							>
								Continue
							</Button>
						</div>
					) : (
						<>
							{data.scopes
								.filter((scope) => scope.category !== "lists")
								.map(scopeRow)}
							<div className="space-y-3 rounded-2xl border border-(--border) bg-(--background-elevated) p-4 sm:p-5">
								<h3 className="font-semibold">New Lists</h3>
								<p className="text-(--foreground-muted) text-sm">
									Default for Lists you create next.
								</p>
								<div className="flex w-fit gap-1 rounded-full bg-(--background-subtle) p-1">
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
												(visibility === "private" &&
													data.availability !== "available")
											}
											onClick={() =>
												choose({
													kind: "default",
													body: { category: "lists", visibility },
												})
											}
										>
											{visibility === "public" ? "Public" : "Private"}
										</Button>
									))}
								</div>
							</div>
							<div className="space-y-3 pt-6">
								<h3 className="font-semibold text-lg">Your Lists</h3>
								<details className="text-sm">
									<summary className="w-fit cursor-pointer text-(--foreground-muted)">
										Change all Lists
									</summary>
									<div className="my-3 flex flex-wrap gap-2">
										{(["public", "private"] as const).map((visibility) => (
											<Button
												key={visibility}
												variant="outline"
												disabled={
													pendingKey === "allLists" ||
													data.scopes.some(
														(scope) =>
															scope.category === "lists" && scope.migration,
													) ||
													(visibility === "private" &&
														data.availability !== "available")
												}
												onClick={() =>
													choose({
														kind: "allLists",
														body: { category: "lists", visibility },
													})
												}
											>
												Change all Lists to{" "}
												{visibility === "public" ? "Public" : "Private"}
											</Button>
										))}
									</div>
								</details>
								{data.scopes
									.filter((scope) => scope.category === "lists")
									.map(scopeRow)}
							</div>
							{onboarding && (
								<Button
									disabled={
										mutation.isPending ||
										data.scopes.some((scope) => scope.migration)
									}
									onClick={onContinue}
								>
									Continue
								</Button>
							)}
						</>
					)}
				</>
			)}
			{mutation.isError && (
				<p role="alert" className="mt-4 text-sm">
					{mutation.error instanceof Error
						? mutation.error.message
						: "Could not complete this change. Try again."}
				</p>
			)}
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
									mutation.mutate({
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
