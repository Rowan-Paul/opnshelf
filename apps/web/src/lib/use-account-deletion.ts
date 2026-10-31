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
	// Captured while signed in: the 401 that ends a deletion clears the user
	// before the effect below can read it.
	const deletingDid = useRef<string | null>(null);
	useEffect(() => {
		if (user) deletingDid.current = user.did;
	}, [user]);

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

	useEffect(() => {
		if (job && isActiveAccountDeletionStatus(job.status)) {
			sawActiveJob.current = true;
		}
		// Only sign out of a deletion we actually watched run. The server returns
		// the most recent job whatever its status, so an account that was deleted
		// and later signed up again still has a completed job on file — without
		// this guard every login gets logged straight back out.
		if (sawActiveJob.current && job?.status === "completed") {
			forgetDeletedAccount(deletingDid.current);
			void logout();
		}
	}, [job, logout]);

	useEffect(() => {
		// The backend deletes the user and revokes the session atomically with (or
		// right after) marking the job completed. If our next poll arrives after
		// revocation, we get a 401 — treat that as "done" and log out.
		if (error && sawActiveJob.current && isUnauthorizedError(error)) {
			forgetDeletedAccount(deletingDid.current);
			void logout();
		}
	}, [error, logout]);

	return job;
}

/** A deleted account can no longer sign in, so the login page stops offering it. */
function forgetDeletedAccount(did: string | null): void {
	if (did) forgetAccount(did);
}

export function isAccountDeletionRunning(
	job: AccountDeletionJobDto | null,
): boolean {
	return !!job && isActiveAccountDeletionStatus(job.status);
}
