import {
	type AccountDeletionJobDto,
	authControllerMeOptions,
	getAccountDeletionProgress,
	getAccountDeletionStatusMessage,
	isActiveAccountDeletionStatus,
	reviewsControllerListMyPublicationsOptions,
	type UserProfileDto,
	usersControllerDeleteMyAccountMutation,
	usersControllerDeleteMyAvatarMutation,
	usersControllerGetMyAccountDeletionOptions,
	usersControllerGetMySettingsOptions,
	usersControllerRefreshMySocialLinksMutation,
	usersControllerUpdateMyProfileMutation,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import {
	AlertTriangle,
	BookOpen,
	Camera,
	ExternalLink,
	Loader2,
	RefreshCw,
	Save,
	Settings,
	Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import CountrySelector from "#/components/CountrySelector";
import { UserAvatar } from "#/components/following/UserAvatar";
import TimezoneSelector from "#/components/TimezoneSelector";
import { TraktImport } from "#/components/trakt/TraktImport";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Switch } from "#/components/ui/switch";
import { apiConfig, ssrAuthOptions } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";

function isUnauthorizedError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		("status" in error || "statusCode" in error) &&
		((error as Record<string, unknown>).status === 401 ||
			(error as Record<string, unknown>).statusCode === 401)
	);
}

export const Route = createFileRoute("/settings")({
	beforeLoad: async ({ context }) => {
		try {
			await context.queryClient.fetchQuery(
				authControllerMeOptions(ssrAuthOptions()),
			);
		} catch (error) {
			if (isUnauthorizedError(error)) {
				throw redirect({
					to: "/login",
					search: { message: "Please log in to view settings" },
				});
			}
			throw error;
		}
	},
	head: () => ({
		meta: [{ title: "Settings | OpnShelf" }],
	}),
	component: SettingsPage,
});

function SettingsPage() {
	const {
		user,
		userSettings,
		isAuthenticated,
		isLoading: authLoading,
		logout,
	} = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	// Redirect if not authenticated
	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			navigate({ to: "/login" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	// Settings mutations
	const updateSettingsMutation = useMutation({
		mutationKey: ["users", "me", "settings", "update"],
		...usersControllerUpdateMySettingsMutation(),
		onSuccess: () => {
			toast.success("Settings updated");
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsOptions().queryKey,
			});
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to update settings",
			);
		},
	});

	const updateProfileMutation = useMutation({
		mutationKey: ["users", "me", "profile", "update"],
		...usersControllerUpdateMyProfileMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: authControllerMeOptions().queryKey,
			});
			toast.success("Display name updated");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to update profile",
			);
		},
	});

	async function uploadAvatar(file: File): Promise<UserProfileDto> {
		const formData = new FormData();
		formData.append("avatar", file);

		const response = await fetch(
			`${apiConfig.baseUrl}/users/me/profile/avatar`,
			{
				method: "POST",
				body: formData,
				credentials: "include",
			},
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({
				message: "Failed to upload avatar",
			}));
			throw new Error(errorData.message || "Failed to upload avatar");
		}

		return response.json();
	}

	const uploadAvatarMutation = useMutation({
		mutationKey: ["users", "me", "profile", "avatar", "upload"],
		mutationFn: uploadAvatar,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: authControllerMeOptions().queryKey,
			});
			toast.success("Profile photo updated");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to upload profile photo",
			);
		},
	});

	const deleteAvatarMutation = useMutation({
		mutationKey: ["users", "me", "profile", "avatar", "delete"],
		...usersControllerDeleteMyAvatarMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: authControllerMeOptions().queryKey,
			});
			toast.success("Profile photo removed");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove profile photo",
			);
		},
	});

	const deleteAccountMutation = useMutation({
		mutationKey: ["users", "me", "account", "delete"],
		...usersControllerDeleteMyAccountMutation(),
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete account",
			);
		},
	});

	// Display name state
	const [displayName, setDisplayName] = useState(user?.displayName ?? "");
	useEffect(() => {
		setDisplayName(user?.displayName ?? "");
	}, [user?.displayName]);

	// Social links visibility state
	const [showBluesky, setShowBluesky] = useState(
		user?.showBlueskyOnProfile ?? true,
	);
	const [showTangled, setShowTangled] = useState(
		user?.showTangledOnProfile ?? true,
	);
	useEffect(() => {
		setShowBluesky(user?.showBlueskyOnProfile ?? true);
		setShowTangled(user?.showTangledOnProfile ?? true);
	}, [user?.showBlueskyOnProfile, user?.showTangledOnProfile]);

	const refreshSocialLinksMutation = useMutation({
		mutationKey: ["users", "me", "profile", "refresh-social-links"],
		...usersControllerRefreshMySocialLinksMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: authControllerMeOptions().queryKey,
			});
			toast.success("Social links refreshed");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to refresh social links",
			);
		},
	});

	// Reviews publication (#118). The live picker — not the cached setting — is
	// the source of truth at selection time; the user can only pick a publication
	// that exists in their own PDS.
	const {
		data: myPublications,
		isLoading: publicationsLoading,
		isError: publicationsError,
	} = useQuery({
		...reviewsControllerListMyPublicationsOptions(),
		enabled: isAuthenticated,
	});

	// The currently-stored target URI (null = no blog mirror).
	const storedPublicationUri = userSettings?.reviewsPublicationUri ?? null;

	const handleSelectPublication = (uri: string | null) => {
		if (uri === storedPublicationUri) {
			return;
		}
		updateSettingsMutation.mutate({ body: { reviewsPublicationUri: uri } });
	};

	// D7 soft warning: the stored target is no longer present in the live list.
	const storedTargetMissing =
		storedPublicationUri !== null &&
		!publicationsLoading &&
		!publicationsError &&
		!myPublications?.items.some((pub) => pub.uri === storedPublicationUri);

	// Avatar file input ref
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleAvatarUpload = (file: File) => {
		uploadAvatarMutation.mutate(file);
	};

	// Deletion dialog state
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [confirmChecked, setConfirmChecked] = useState(false);
	const [deletePDSData, setDeletePDSData] = useState(false);
	const [deletionJob, setDeletionJob] = useState<AccountDeletionJobDto | null>(
		null,
	);

	// Poll deletion status when there's an active job
	const { data: deletionStatus } = useQuery({
		...usersControllerGetMyAccountDeletionOptions(),
		enabled: !!deletionJob && isActiveAccountDeletionStatus(deletionJob.status),
		refetchInterval: 2000,
	});

	useEffect(() => {
		if (deletionStatus) {
			setDeletionJob(deletionStatus);
			if (deletionStatus.status === "completed") {
				void logout();
			}
		}
	}, [deletionStatus, logout]);

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

	if (authLoading) {
		return (
			<div className="container-app flex min-h-[50vh] items-center justify-center py-8">
				<Loader2 className="size-8 animate-spin text-(--accent)" />
			</div>
		);
	}

	if (!isAuthenticated || !user) {
		return null;
	}

	return (
		<div className="container-app max-w-2xl py-8">
			{/* Page Header */}
			<div className="mb-8 flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent-subtle) text-(--accent)">
					<Settings className="size-5" />
				</div>
				<div>
					<h1 className="text-display-2">Settings</h1>
					<p className="text-(--foreground-muted)">
						Manage your account and preferences
					</p>
				</div>
			</div>

			<div className="space-y-6">
				{/* Time & Region */}
				<section className="card p-6">
					<h2 className="mb-1 font-semibold text-lg">Time & Region</h2>
					<p className="mb-6 text-(--foreground-muted) text-sm">
						Choose how dates and times are displayed
					</p>

					<div className="space-y-5">
						<div className="space-y-2">
							<label htmlFor="timezone" className="font-medium text-sm">
								Timezone
							</label>
							<TimezoneSelector
								value={userSettings?.timezone}
								onChange={(timezone) =>
									updateSettingsMutation.mutate({
										body: { timezone },
									})
								}
								disabled={updateSettingsMutation.isPending}
							/>
						</div>

						<div className="flex items-center justify-between">
							<div>
								<label htmlFor="time-format" className="font-medium text-sm">
									24-hour time
								</label>
								<p className="text-(--foreground-muted) text-sm">
									Display times in 24-hour format
								</p>
							</div>
							<Switch
								id="time-format"
								checked={userSettings?.timeFormat === "24h"}
								onCheckedChange={(checked) =>
									updateSettingsMutation.mutate({
										body: { timeFormat: checked ? "24h" : "12h" },
									})
								}
								disabled={updateSettingsMutation.isPending}
							/>
						</div>
					</div>
				</section>

				{/* Streaming */}
				<section className="card p-6">
					<h2 className="mb-1 font-semibold text-lg">Streaming</h2>
					<p className="mb-6 text-(--foreground-muted) text-sm">
						Choose your country to see where movies and shows are available to
						watch
					</p>
					<div className="space-y-2">
						<label htmlFor="watch-country" className="font-medium text-sm">
							Country
						</label>
						<CountrySelector
							value={userSettings?.watchCountry}
							onChange={(watchCountry) =>
								updateSettingsMutation.mutate({
									body: { watchCountry },
								})
							}
							disabled={updateSettingsMutation.isPending}
						/>
					</div>
				</section>

				{/* Import history */}
				<section className="card p-6">
					<TraktImport
						idleShowsInput
						title="Import history"
						description="Import your public watch history from Trakt.tv. We add anything you haven't logged yet."
						titleClassName="font-semibold text-lg"
					/>
				</section>

				{/* Reviews publication */}
				<section className="card p-6">
					<div className="mb-1 flex items-center gap-2">
						<BookOpen className="size-5 text-(--accent)" />
						<h2 className="font-semibold text-lg">Blog mirror</h2>
					</div>
					<p className="mb-6 text-(--foreground-muted) text-sm">
						Your reviews always live on OpnShelf. Optionally, mirror new reviews
						to one of your own AT Protocol publications as well.
					</p>

					{storedTargetMissing && (
						<div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
							<AlertTriangle className="mt-0.5 size-4 shrink-0" />
							<span>
								Your selected publication is no longer in your PDS. New reviews
								still point at it, but you may want to choose another below.
							</span>
						</div>
					)}

					{publicationsLoading ? (
						<div className="flex items-center gap-2 text-(--foreground-muted) text-sm">
							<Loader2 className="size-4 animate-spin" />
							Loading your publications…
						</div>
					) : publicationsError ? (
						<p className="text-(--foreground-muted) text-sm">
							Could not load your publications right now.
						</p>
					) : (
						<fieldset
							className="space-y-2"
							disabled={updateSettingsMutation.isPending}
						>
							<label className="flex cursor-pointer items-center justify-between rounded-lg border border-(--border) p-3 transition-colors hover:border-(--accent) has-checked:border-(--accent) has-checked:bg-(--accent-subtle)">
								<div className="flex items-center gap-3">
									<input
										type="radio"
										name="reviews-publication"
										className="size-4 accent-(--accent)"
										checked={storedPublicationUri === null}
										onChange={() => handleSelectPublication(null)}
									/>
									<div>
										<p className="font-medium text-sm">None</p>
										<p className="text-(--foreground-muted) text-xs">
											Don't mirror reviews to a blog
										</p>
									</div>
								</div>
							</label>
							{(myPublications?.items ?? []).map((pub) => (
								<label
									key={pub.uri}
									className="flex cursor-pointer items-center justify-between rounded-lg border border-(--border) p-3 transition-colors hover:border-(--accent) has-checked:border-(--accent) has-checked:bg-(--accent-subtle)"
								>
									<div className="flex items-center gap-3">
										<input
											type="radio"
											name="reviews-publication"
											className="size-4 accent-(--accent)"
											checked={storedPublicationUri === pub.uri}
											onChange={() => handleSelectPublication(pub.uri)}
										/>
										<div>
											<p className="font-medium text-sm">{pub.name}</p>
											<p className="text-(--foreground-muted) text-xs">
												{pub.url}
											</p>
										</div>
									</div>
								</label>
							))}
						</fieldset>
					)}
				</section>

				{/* Account */}
				<section className="card p-6">
					<h2 className="mb-1 font-semibold text-lg">Account</h2>
					<p className="mb-6 text-(--foreground-muted) text-sm">
						Update your profile information
					</p>

					<div className="space-y-5">
						{/* Avatar */}
						<div className="flex items-center gap-4">
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								aria-label="Upload profile photo"
								className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-(--border) border-2 bg-(--background-subtle) transition-colors hover:border-(--accent) focus-visible:outline-none focus-visible:ring-(--accent) focus-visible:ring-2"
							>
								<UserAvatar
									src={user.avatar}
									alt=""
									className="h-full w-full rounded-full"
								/>
								<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
									<Camera className="size-5 text-white" />
								</div>
								{uploadAvatarMutation.isPending && (
									<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
										<Loader2 className="size-5 animate-spin text-white" />
									</div>
								)}
							</button>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								className="sr-only"
								onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) handleAvatarUpload(file);
									e.target.value = "";
								}}
							/>
							<div>
								<p className="font-medium text-sm">Profile photo</p>
								<p className="text-(--foreground-muted) text-sm">
									Click the avatar to upload a new photo
								</p>
								{user.avatar && (
									<button
										type="button"
										onClick={() => deleteAvatarMutation.mutate({})}
										disabled={deleteAvatarMutation.isPending}
										className="mt-1 font-medium text-red-600 text-sm hover:text-red-700 disabled:opacity-50"
									>
										{deleteAvatarMutation.isPending
											? "Removing…"
											: "Remove photo"}
									</button>
								)}
							</div>
						</div>

						{/* Display Name */}
						<div className="space-y-2">
							<label htmlFor="display-name" className="font-medium text-sm">
								Display name
							</label>
							<div className="flex gap-2">
								<input
									id="display-name"
									type="text"
									value={displayName}
									onChange={(e) => setDisplayName(e.target.value)}
									placeholder="Your display name"
									className="input flex-1"
								/>
								<Button
									onClick={() =>
										updateProfileMutation.mutate({
											body: { displayName: displayName || undefined },
										})
									}
									disabled={
										updateProfileMutation.isPending ||
										displayName === (user.displayName ?? "")
									}
								>
									{updateProfileMutation.isPending ? (
										<Loader2
											data-icon="inline-start"
											className="animate-spin"
										/>
									) : (
										<Save data-icon="inline-start" />
									)}
									Save
								</Button>
							</div>
						</div>

						{/* Handle */}
						<div className="space-y-2">
							<label htmlFor="handle" className="font-medium text-sm">
								Handle
							</label>
							<input
								id="handle"
								type="text"
								value={`@${user.handle}`}
								disabled
								className="input cursor-not-allowed bg-(--background-subtle)"
								readOnly
							/>
							<p className="text-(--foreground-muted) text-xs">
								Your handle is managed by your Bluesky account
							</p>
						</div>

						{/* Social Links */}
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="font-medium text-sm">Social links</h3>
								<button
									type="button"
									onClick={() => refreshSocialLinksMutation.mutate({})}
									disabled={refreshSocialLinksMutation.isPending}
									className="inline-flex items-center gap-1.5 text-(--accent) text-sm hover:underline disabled:opacity-50"
								>
									{refreshSocialLinksMutation.isPending ? (
										<Loader2 className="size-3.5 animate-spin" />
									) : (
										<RefreshCw className="size-3.5" />
									)}
									Refresh
								</button>
							</div>
							<p className="text-(--foreground-muted) text-xs">
								We automatically detect your Bluesky and Tangled profiles from
								your PDS. Toggle to control visibility.
							</p>

							{/* Bluesky */}
							<div className="flex items-center justify-between rounded-lg border border-(--border) p-3">
								<div className="flex items-center gap-3">
									<img src="/bluesky.svg" alt="Bluesky" className="size-5" />
									<div>
										<p className="font-medium text-sm">Bluesky</p>
										{user.blueskyProfileUrl ? (
											<a
												href={user.blueskyProfileUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1 text-(--accent) text-xs hover:underline"
											>
												View profile
												<ExternalLink className="size-3" />
											</a>
										) : (
											<p className="text-(--foreground-muted) text-xs">
												Not found
											</p>
										)}
									</div>
								</div>
								<Switch
									checked={showBluesky}
									onCheckedChange={(checked) => {
										setShowBluesky(checked);
										updateProfileMutation.mutate({
											body: { showBlueskyOnProfile: checked },
										});
									}}
									disabled={
										updateProfileMutation.isPending || !user.blueskyProfileUrl
									}
								/>
							</div>

							{/* Tangled */}
							<div className="flex items-center justify-between rounded-lg border border-(--border) p-3">
								<div className="flex items-center gap-3">
									<div className="relative size-5">
										<img
											src="/tangled-black.svg"
											alt="Tangled"
											className="absolute inset-0 block h-full w-full object-contain dark:hidden"
										/>
										<img
											src="/tangled-white.svg"
											alt="Tangled"
											className="absolute inset-0 hidden h-full w-full object-contain dark:block"
										/>
									</div>
									<div>
										<p className="font-medium text-sm">Tangled</p>
										{user.tangledProfileUrl ? (
											<a
												href={user.tangledProfileUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1 text-(--accent) text-xs hover:underline"
											>
												View profile
												<ExternalLink className="size-3" />
											</a>
										) : (
											<p className="text-(--foreground-muted) text-xs">
												Not found
											</p>
										)}
									</div>
								</div>
								<Switch
									checked={showTangled}
									onCheckedChange={(checked) => {
										setShowTangled(checked);
										updateProfileMutation.mutate({
											body: { showTangledOnProfile: checked },
										});
									}}
									disabled={
										updateProfileMutation.isPending || !user.tangledProfileUrl
									}
								/>
							</div>
						</div>
					</div>
				</section>

				{/* Account Deletion */}
				<section className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
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
			</div>

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
								Also delete my OpnShelf data from my PDS, including watch
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
		</div>
	);
}
