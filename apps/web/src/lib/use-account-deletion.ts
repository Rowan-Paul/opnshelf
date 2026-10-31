import {
	type AccountDeletionJobDto,
	isActiveAccountDeletionStatus,
	isUnauthorizedError,
	usersControllerGetMyAccountDeletionOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "#/lib/auth-context";
import { forgetAccount } from "#/lib/recent-accounts";

/**
 * The current account-deletion job, read from the server instead of component
 * state, so a running PDS deletion is still known after a page reload. Polls
 * while the job is active and logs out once it finishes.
 */
export function useAccountDeletionJob(): AccountDeletionJobDto | null {
	const { isAuthenticated, logout, user } = useAuth();

	const { data, error } = useQuery({
		...usersControllerGetMyAccountDeletionOptions(),
		enabled: isAuthenticated,
		refetchInterval: (query) =>
			query.state.data && isActiveAccountDeletionStatus(query.state.data.status)
				? 2000
				: false,
		retry: false,
	});

	const job = data ?? null;
	const sawActiveJob = useRef(false);

	// A deleted account can no longer sign in, so stop offering it as soon as a
	// deletion is running rather than when it completes: the app may be closed
	// by then, and the revoked session means this hook never runs again. Also
	// re-runs when the user refetches, which would otherwise remember it again.
	useEffect(() => {
		if (user && job && isActiveAccountDeletionStatus(job.status)) {
			void forgetAccount(user.did);
		}
	}, [user, job]);

	useEffect(() => {
		if (job && isActiveAccountDeletionStatus(job.status)) {
			sawActiveJob.current = true;
		}
		// Only sign out of a deletion we actually watched run. The server returns
		// the most recent job whatever its status, so an account that was deleted
		// and later signed up again still has a completed job on file — without
		// this guard every login gets logged straight back out.
		if (sawActiveJob.current && job?.status === "completed") {
			void logout();
		}
	}, [job, logout]);

	useEffect(() => {
		// The backend deletes the user and revokes the session atomically with (or
		// right after) marking the job completed. If our next poll arrives after
		// revocation, we get a 401 — treat that as "done" and log out.
		if (error && sawActiveJob.current && isUnauthorizedError(error)) {
			void logout();
		}
	}, [error, logout]);

	return job;
}

export function isAccountDeletionRunning(
	job: AccountDeletionJobDto | null,
): boolean {
	return !!job && isActiveAccountDeletionStatus(job.status);
}
