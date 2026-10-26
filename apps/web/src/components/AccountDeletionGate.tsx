import { CatchBoundary } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import {
	isAccountDeletionRunning,
	useAccountDeletionJob,
} from "#/lib/use-account-deletion";

const AccountDeletionDialog = lazy(() => import("./AccountDeletionDialog"));

/**
 * Stands in for the dialog while its chunk loads, or if it fails to, so the
 * page stays blocked either way.
 */
function AccountDeletionBlock() {
	return (
		<div
			role="alertdialog"
			aria-modal="true"
			aria-busy="true"
			aria-label="Deleting your account"
			className="fixed inset-0 z-50 bg-black/50"
		/>
	);
}

/**
 * Site-wide block while a PDS deletion job runs. Mounted at the root so the
 * dialog comes back after a page reload — the job lives on the server, not in
 * the settings page that started it.
 */
export function AccountDeletionGate() {
	const job = useAccountDeletionJob();
	if (!isAccountDeletionRunning(job) || !job) return null;

	return (
		<CatchBoundary getResetKey={() => 0} errorComponent={AccountDeletionBlock}>
			<Suspense fallback={<AccountDeletionBlock />}>
				<AccountDeletionDialog job={job} />
			</Suspense>
		</CatchBoundary>
	);
}
