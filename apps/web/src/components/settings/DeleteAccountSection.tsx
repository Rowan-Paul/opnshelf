import {
	usersControllerDeleteMyAccountMutation,
	usersControllerGetMyAccountDeletionOptions,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
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
import {
	isAccountDeletionRunning,
	useAccountDeletionJob,
} from "#/lib/use-account-deletion";

export function DeleteAccountSection() {
	const { logout } = useAuth();
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [confirmChecked, setConfirmChecked] = useState(false);
	const [deletePDSData, setDeletePDSData] = useState(false);
	// The job lives on the server and is polled by `useAccountDeletionJob` (also
	// mounted at the app root, which renders the blocking dialog), so it survives
	// a page reload.
	const deletionJob = useAccountDeletionJob();
	const queryClient = useQueryClient();

	const deleteAccountMutation = useMutation({
		mutationKey: ["users", "me", "account", "delete"],
		...usersControllerDeleteMyAccountMutation(),
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete account",
			);
		},
	});

	const handleDeleteAccount = async () => {
		try {
			await deleteAccountMutation.mutateAsync({ body: { deletePDSData } });
			if (!deletePDSData) {
				// Immediate deletion, no job returned
				await logout();
				return;
			}
			// PDS deletion job started — let the shared query pick it up.
			setShowDeleteDialog(false);
			await queryClient.invalidateQueries({
				queryKey: usersControllerGetMyAccountDeletionOptions().queryKey,
			});
		} catch {
			// Error handled by mutation state
		}
	};

	const isDeleting = isAccountDeletionRunning(deletionJob);

	return (
		<>
			<section
				id="danger-zone"
				className="mt-6 scroll-mt-24 rounded-xl border border-destructive/40 bg-destructive/5 p-5 sm:p-6"
			>
				<h2 className="mb-1 font-display font-semibold text-destructive text-lg">
					Danger Zone
				</h2>
				<p className="mb-6 text-destructive text-sm">
					Permanently delete your account and all associated data
				</p>

				{isDeleting ? (
					<div className="flex items-center gap-2 text-destructive/80">
						<Loader2 className="size-4 animate-spin" />
						<span className="font-medium text-sm">
							Account deletion in progress…
						</span>
					</div>
				) : deletionJob?.status === "failed" ? (
					<div className="space-y-2">
						<p className="text-destructive text-sm">
							{deletionJob.lastError ?? "Account deletion failed."}
						</p>
						<Button
							variant="outline"
							onClick={handleDeleteAccount}
							disabled={deleteAccountMutation.isPending}
							className="border-destructive/40 text-destructive hover:bg-destructive/10"
						>
							{deleteAccountMutation.isPending ? (
								<Loader2 data-icon="inline-start" className="animate-spin" />
							) : null}
							Retry
						</Button>
					</div>
				) : (
					<button
						type="button"
						onClick={() => {
							setConfirmChecked(false);
							setDeletePDSData(false);
							setShowDeleteDialog(true);
						}}
						className="btn inline-flex items-center gap-2 border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
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
						<DialogTitle className="flex items-center gap-2 text-destructive">
							<AlertTriangle className="size-5" />
							Delete your account?
						</DialogTitle>
						<DialogDescription>
							This action cannot be undone. All your data will be permanently
							removed. Trakt Sync stops; records already transferred to Trakt
							remain there.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="flex items-start gap-3 rounded-lg border border-(--border) p-3">
							<input
								type="checkbox"
								id="confirm-delete"
								checked={confirmChecked}
								onChange={(e) => setConfirmChecked(e.target.checked)}
								className="mt-0.5 h-4 w-4 shrink-0 rounded border-(--border) accent-(--destructive)"
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
								className="mt-0.5 h-4 w-4 shrink-0 rounded border-(--border) accent-(--destructive)"
							/>
							<label htmlFor="delete-pds" className="text-sm leading-relaxed">
								Also delete the records Opnshelf saved to your account's data
								store (your PDS). This covers watch history, follows, lists, and
								list items.
							</label>
						</div>

						{deleteAccountMutation.isError && (
							<div className="flex items-center gap-2 rounded-lg bg-destructive/5 p-3 text-destructive text-sm">
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
							className="bg-destructive-solid hover:bg-destructive-solid-hover"
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

			{/* The blocking progress dialog lives at the app root
			    (AccountDeletionGate), so it also shows after a page reload. */}
		</>
	);
}
