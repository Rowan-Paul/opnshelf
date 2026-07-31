import {
	type AccountDeletionJobDto,
	getAccountDeletionProgress,
	getAccountDeletionStatusMessage,
	isActiveAccountDeletionStatus,
	isUnauthorizedError,
	usersControllerDeleteMyAccountMutation,
	usersControllerGetMyAccountDeletionOptions,
} from "@opnshelf/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useAuth } from "#/lib/auth-context";

export function DeleteAccountSection() {
	const { logout } = useAuth();
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [confirmChecked, setConfirmChecked] = useState(false);
	const [deletePDSData, setDeletePDSData] = useState(false);
	const [deletionJob, setDeletionJob] = useState<AccountDeletionJobDto | null>(
		null,
	);

	const deleteAccountMutation = useMutation({
		mutationKey: ["users", "me", "account", "delete"],
		...usersControllerDeleteMyAccountMutation(),
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete account",
			);
		},
	});

	// Poll deletion status when there's an active job
	const { data: deletionStatus, error: deletionError } = useQuery({
		...usersControllerGetMyAccountDeletionOptions(),
		enabled: !!deletionJob && isActiveAccountDeletionStatus(deletionJob.status),
		refetchInterval: 2000,
		retry: false,
	});

	useEffect(() => {
		if (deletionStatus) {
			setDeletionJob(deletionStatus);
			if (deletionStatus.status === "completed") {
				void logout();
			}
		}
	}, [deletionStatus, logout]);

	useEffect(() => {
		if (deletionError && deletionJob && isUnauthorizedError(deletionError)) {
			// The backend deletes the user and revokes the session atomically with
			// (or right after) marking the job completed. If our next poll arrives
			// after revocation, we get a 401 — treat that as "done" and sign out.
			void logout();
		}
	}, [deletionError, deletionJob, logout]);

	const handleDeleteAccount = async () => {
		try {
			const result = await deleteAccountMutation.mutateAsync({
				body: { deletePDSData },
			});
			if (!deletePDSData) {
				// Immediate deletion, no job returned
				await logout();
				return;
			}
			// PDS deletion job started
			if (result) {
				setDeletionJob(result);
				setShowDeleteDialog(false);
			}
		} catch {
			// Error handled by mutation state
		}
	};

	const isDeleting =
		!!deletionJob && isActiveAccountDeletionStatus(deletionJob.status);
	const deletionProgress = deletionJob
		? getAccountDeletionProgress(deletionJob)
		: null;
	const deletionMessage = deletionJob
		? getAccountDeletionStatusMessage(deletionJob)
		: "";

	return (
		<>
			<section
				id="danger-zone"
				className="scroll-mt-24 rounded-xl border border-red-200 bg-red-50 p-5 sm:p-6 dark:border-red-900 dark:bg-red-950/30"
			>
				<h2 className="mb-1 font-semibold text-lg text-red-900 dark:text-red-100">
					Danger Zone
				</h2>
				<p className="mb-6 text-red-700 text-sm dark:text-red-300">
					Permanently delete your account and all associated data
				</p>

				{isDeleting && deletionJob ? (
					<div className="flex items-center gap-2 text-red-800 dark:text-red-200">
						<Loader2 className="size-4 animate-spin" />
						<span className="font-medium text-sm">
							Account deletion in progress…
						</span>
					</div>
				) : (
					<button
						type="button"
						onClick={() => {
							setConfirmChecked(false);
							setDeletePDSData(false);
							setShowDeleteDialog(true);
						}}
						className="btn inline-flex items-center gap-2 border-red-300 bg-red-100 text-red-700 hover:bg-red-200 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
					>
						<Trash2 className="size-4" />
						Delete Account
					</button>
				)}
			</section>

			{/* Delete Account Confirmation Dialog */}
			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
							<AlertTriangle className="size-5" />
							Delete your account?
						</DialogTitle>
						<DialogDescription>
							This action cannot be undone. All your data will be permanently
							removed.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="flex items-start gap-3 rounded-lg border border-(--border) p-3">
							<input
								type="checkbox"
								id="confirm-delete"
								checked={confirmChecked}
								onChange={(e) => setConfirmChecked(e.target.checked)}
								className="mt-0.5 h-4 w-4 shrink-0 rounded border-(--border) accent-red-600"
							/>
							<label
								htmlFor="confirm-delete"
								className="text-sm leading-relaxed"
							>
								I understand that deleting my account is permanent and cannot be
								undone.
							</label>
						</div>

						<div className="flex items-start gap-3 rounded-lg border border-(--border) p-3">
							<input
								type="checkbox"
								id="delete-pds"
								checked={deletePDSData}
								onChange={(e) => setDeletePDSData(e.target.checked)}
								className="mt-0.5 h-4 w-4 shrink-0 rounded border-(--border) accent-red-600"
							/>
							<label htmlFor="delete-pds" className="text-sm leading-relaxed">
								Also delete my Opnshelf data from my PDS, including watch
								history, follows, lists, and list items.
							</label>
						</div>

						{deleteAccountMutation.isError && (
							<div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700 text-sm dark:bg-red-950/50 dark:text-red-300">
								<AlertTriangle className="size-4 shrink-0" />
								<span>
									{deleteAccountMutation.error instanceof Error
										? deleteAccountMutation.error.message
										: "Failed to delete account. Please try again."}
								</span>
							</div>
						)}
					</div>

					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button
							variant="outline"
							onClick={() => setShowDeleteDialog(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeleteAccount}
							disabled={!confirmChecked || deleteAccountMutation.isPending}
							className="bg-red-600 hover:bg-red-700"
						>
							{deleteAccountMutation.isPending ? (
								<Loader2 data-icon="inline-start" className="animate-spin" />
							) : (
								<Trash2 data-icon="inline-start" />
							)}
							Permanently Delete Account
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Deletion Progress Dialog — non-dismissible */}
			<Dialog open={isDeleting && !!deletionJob}>
				<DialogContent
					showCloseButton={false}
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
					className="sm:max-w-[425px]"
				>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
							<AlertTriangle className="size-5" />
							Deleting your account
						</DialogTitle>
						<DialogDescription>
							Please do not close this page until deletion is complete.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="flex items-center gap-2 text-red-800 dark:text-red-200">
							<Loader2 className="size-4 animate-spin" />
							<span className="font-medium text-sm">{deletionMessage}</span>
						</div>
						{deletionProgress !== null && (
							<div className="h-2 w-full overflow-hidden rounded-full bg-red-200 dark:bg-red-900">
								<div
									className="h-full rounded-full bg-red-600 transition-all dark:bg-red-400"
									style={{ width: `${deletionProgress}%` }}
								/>
							</div>
						)}
						{deletionJob?.status === "failed" && (
							<div className="space-y-2">
								<p className="text-red-700 text-sm dark:text-red-300">
									{deletionJob.lastError}
								</p>
								<Button
									variant="outline"
									onClick={handleDeleteAccount}
									disabled={deleteAccountMutation.isPending}
									className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900"
								>
									{deleteAccountMutation.isPending ? (
										<Loader2
											data-icon="inline-start"
											className="animate-spin"
										/>
									) : null}
									Retry
								</Button>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
