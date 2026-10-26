import { lazy, Suspense } from "react";
import {
	isAccountDeletionRunning,
	useAccountDeletionJob,
} from "#/lib/use-account-deletion";

const AccountDeletionDialog = lazy(() => import("./AccountDeletionDialog"));

/**
 * Site-wide block while a PDS deletion job runs. Mounted at the root so the
 * dialog comes back after a page reload — the job lives on the server, not in
 * the settings page that started it.
 */
export function AccountDeletionGate() {
	const job = useAccountDeletionJob();
	if (!isAccountDeletionRunning(job) || !job) return null;

	return (
		<Suspense fallback={null}>
			<AccountDeletionDialog job={job} />
		</Suspense>
	);
}
