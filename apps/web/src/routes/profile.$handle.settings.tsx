import {
	type AccountDeletionJobDto,
	authControllerMeOptions,
	authControllerMeQueryKey,
	getAccountDeletionProgress,
	getAccountDeletionStepLabel,
	isActiveAccountDeletionStatus,
	usersControllerDeleteMyAccountMutation,
	usersControllerDeleteMyAvatarMutation,
	usersControllerGetMyAccountDeletionOptions,
	usersControllerGetMySettingsOptions,
	usersControllerGetPublicProfileOptions,
	usersControllerUpdateMyProfileMutation,
	usersControllerUpdateMySettingsMutation,
	usersControllerUploadMyAvatarMutation,
} from "@opnshelf/api";
import { usePostHog } from "@posthog/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import {
	AlertTriangle,
	Camera,
	Clock,
	Globe,
	Loader2,
	Palette,
	Trash2,
	User,
} from "lucide-react";
import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { AuthLoadingState } from "@/components/AuthLoadingState";
import { useTheme } from "@/components/theme-provider";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { publishSignedOutAuthState } from "@/lib/auth-cache";
import {
	AVATAR_UPLOAD_HELP_TEXT,
	getAvatarUploadErrorMessage,
	validateAvatarFile,
} from "@/lib/avatar-upload";
import { getProfileRoute, isOwnerProfile } from "@/lib/profile-routes";
import { getSsrAuthHeaders } from "@/lib/ssr-auth-headers";
import { TIMEZONE_GROUPS } from "@/lib/timezones";
import { clearDismissedTraktImportJobIds } from "@/lib/trakt-import-dismissal";

export const Route = createFileRoute("/profile/$handle/settings")({
	beforeLoad: async ({ context, params }) => {
		const handle = params.handle.trim().replace(/^@/, "").toLowerCase();
		const authHeaders = await getSsrAuthHeaders();
		const [currentUser, profile] = await Promise.all([
			context.queryClient
				.ensureQueryData({
					...authControllerMeOptions(authHeaders),
					staleTime: 5 * 60 * 1000,
					retry: false,
				})
				.catch(() => null),
			context.queryClient
				.ensureQueryData({
					...usersControllerGetPublicProfileOptions({
						path: { handle },
					}),
					retry: false,
				})
				.catch(() => null),
		]);

		if (!profile || !isOwnerProfile(currentUser?.did, profile.did)) {
			throw redirect({
				...getProfileRoute(handle, "shelf", { page: 1 }),
			});
		}
	},
	head: ({ params }) => ({
		meta: [
			{ title: `@${params.handle.replace(/^@/, "")} Settings | OpnShelf` },
		],
	}),
	component: SettingsPage,
});

function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}

	return fallback;
}

function SettingsPage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { seedColor } = useTheme();
	const timezoneId = useId();
	const deletePdsId = useId();
	const displayNameId = useId();
	const posthog = usePostHog();
	const avatarInputRef = useRef<HTMLInputElement | null>(null);

	const { data: user, isLoading: isAuthLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const { data: settings, isLoading: isSettingsLoading } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user,
	});

	const [timezone, setTimezone] = useState<string>("UTC");
	const [is24Hour, setIs24Hour] = useState<boolean>(true);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [deletePDSData, setDeletePDSData] = useState(false);
	const [deletionJobId, setDeletionJobId] = useState<string | null>(null);
	const [displayName, setDisplayName] = useState("");
	const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(
		null,
	);
	const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
	const [avatarErrorMessage, setAvatarErrorMessage] = useState<string | null>(
		null,
	);

	useEffect(() => {
		if (settings) {
			setTimezone(settings.timezone);
			setIs24Hour(settings.timeFormat === "24h");
		}
	}, [settings]);

	useEffect(() => {
		setDisplayName(user?.displayName ? String(user.displayName) : "");
	}, [user?.displayName]);

	useEffect(() => {
		if (!selectedAvatarFile) {
			setAvatarPreviewUrl(user?.avatar ? String(user.avatar) : null);
			return;
		}

		const objectUrl = URL.createObjectURL(selectedAvatarFile);
		setAvatarPreviewUrl(objectUrl);
		return () => {
			URL.revokeObjectURL(objectUrl);
		};
	}, [selectedAvatarFile, user?.avatar]);

	const updateSettingsMutation = useMutation({
		mutationKey: ["users", "settings", "update"],
		...usersControllerUpdateMySettingsMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsOptions().queryKey,
			});
			toast.success("Settings saved");
		},
		onError: () => {
			toast.error("Failed to save settings");
		},
	});

	const deletionJobQuery = useQuery({
		...usersControllerGetMyAccountDeletionOptions(),
		enabled: !!deletionJobId,
		refetchInterval: (query) => {
			const job = query.state.data;
			if (!job || !isActiveAccountDeletionStatus(job.status)) {
				return false;
			}
			return 2_000;
		},
	});

	const handleDeletionComplete = useCallback(async () => {
		if (user?.did) {
			clearDismissedTraktImportJobIds(user.did);
		}
		posthog.capture("account_deleted", { deleted_pds_data: true });
		posthog.reset();
		setShowDeleteDialog(false);
		setDeletionJobId(null);
		toast.success("Account deleted");
		await publishSignedOutAuthState(queryClient);
		router.navigate({ to: "/" });
	}, [user?.did, posthog, queryClient, router]);

	useEffect(() => {
		const job = deletionJobQuery.data;
		if (!job) {
			return;
		}

		if (job.status === "completed") {
			handleDeletionComplete();
		}
	}, [
		deletionJobQuery.data?.status,
		deletionJobQuery.data,
		handleDeletionComplete,
	]);

	useEffect(() => {
		if (deletionJobQuery.error && deletionJobId) {
			handleDeletionComplete();
		}
	}, [deletionJobQuery.error, deletionJobId, handleDeletionComplete]);

	const deleteAccountMutation = useMutation({
		mutationKey: ["users", "account", "delete"],
		...usersControllerDeleteMyAccountMutation(),
		onSuccess: async (data) => {
			const job = data as AccountDeletionJobDto | undefined;
			if (job?.id) {
				setDeletionJobId(job.id);
				return;
			}

			if (user?.did) {
				clearDismissedTraktImportJobIds(user.did);
			}
			posthog.capture("account_deleted", {
				deleted_pds_data: false,
			});
			posthog.reset();
			setShowDeleteDialog(false);
			toast.success("Account deleted");
			await publishSignedOutAuthState(queryClient);
			router.navigate({ to: "/" });
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Failed to delete account"));
		},
	});

	const updateProfileMutation = useMutation({
		mutationKey: ["users", "profile", "update"],
		...usersControllerUpdateMyProfileMutation(),
		onSuccess: async (updatedProfile) => {
			await refreshProfileState(updatedProfile);
			toast.success("Profile saved");
		},
		onError: () => {
			toast.error("Failed to save profile");
		},
	});

	const uploadAvatarMutation = useMutation({
		mutationKey: ["users", "profile", "avatar", "upload"],
		...usersControllerUploadMyAvatarMutation(),
		onSuccess: async (updatedProfile) => {
			setSelectedAvatarFile(null);
			setAvatarErrorMessage(null);
			if (avatarInputRef.current) {
				avatarInputRef.current.value = "";
			}
			await refreshProfileState(updatedProfile);
			toast.success("Profile photo updated");
		},
		onError: (error) => {
			setAvatarErrorMessage(
				getAvatarUploadErrorMessage(error, "Failed to upload profile photo"),
			);
		},
	});

	const deleteAvatarMutation = useMutation({
		mutationKey: ["users", "profile", "avatar", "delete"],
		...usersControllerDeleteMyAvatarMutation(),
		onSuccess: async (updatedProfile) => {
			setSelectedAvatarFile(null);
			setAvatarErrorMessage(null);
			if (avatarInputRef.current) {
				avatarInputRef.current.value = "";
			}
			await refreshProfileState(updatedProfile);
			toast.success("Profile photo removed");
		},
		onError: () => {
			toast.error("Failed to remove profile photo");
		},
	});

	const refreshProfileState = async (updatedProfile: {
		displayName: string | null;
		avatar: string | null;
	}) => {
		queryClient.setQueryData(authControllerMeQueryKey(), (previousUser) => {
			if (!previousUser) {
				return previousUser;
			}

			return {
				...previousUser,
				displayName: updatedProfile.displayName,
				avatar: updatedProfile.avatar,
			};
		});

		if (user?.handle) {
			queryClient.setQueryData(
				usersControllerGetPublicProfileOptions({
					path: { handle: user.handle },
				}).queryKey,
				(previousProfile) => {
					if (!previousProfile) {
						return previousProfile;
					}

					return {
						...previousProfile,
						displayName: updatedProfile.displayName,
						avatar: updatedProfile.avatar,
					};
				},
			);
		}

		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: authControllerMeQueryKey(),
			}),
			user?.handle
				? queryClient.invalidateQueries({
						queryKey: usersControllerGetPublicProfileOptions({
							path: { handle: user.handle },
						}).queryKey,
					})
				: Promise.resolve(),
		]);
	};

	const handleTimezoneChange = (value: string) => {
		setTimezone(value);
		updateSettingsMutation.mutate({
			body: { timezone: value },
		});
	};

	const handleTimeFormatToggle = (checked: boolean) => {
		setIs24Hour(checked);
		updateSettingsMutation.mutate({
			body: { timeFormat: checked ? "24h" : "12h" },
		});
	};

	const handleAvatarSelection = (event: ChangeEvent<HTMLInputElement>) => {
		const nextFile = event.target.files?.[0] ?? null;
		if (!nextFile) {
			setSelectedAvatarFile(null);
			setAvatarErrorMessage(null);
			return;
		}

		const validationMessage = validateAvatarFile(nextFile);
		if (validationMessage) {
			event.target.value = "";
			setSelectedAvatarFile(null);
			setAvatarErrorMessage(validationMessage);
			return;
		}

		setAvatarErrorMessage(null);
		setSelectedAvatarFile(nextFile);
	};

	const handleProfileSave = () => {
		updateProfileMutation.mutate({
			body: {
				displayName,
			},
		});
	};

	const handleAvatarUpload = () => {
		if (!selectedAvatarFile) {
			return;
		}

		uploadAvatarMutation.mutate({
			body: {
				avatar: selectedAvatarFile,
			},
		});
	};

	const getCurrentTimeDisplay = () => {
		const now = new Date();
		try {
			return now.toLocaleTimeString("en-US", {
				timeZone: timezone,
				hour12: !is24Hour,
				hour: "numeric",
				minute: "2-digit",
			});
		} catch {
			return now.toLocaleTimeString("en-US", {
				hour12: !is24Hour,
				hour: "numeric",
				minute: "2-digit",
			});
		}
	};

	if (isAuthLoading) {
		return <AuthLoadingState className="max-w-3xl py-4" />;
	}

	if (!user) {
		return null;
	}

	return (
		<div className="max-w-3xl space-y-6 text-(--md-sys-color-on-surface)">
			<div className="mb-2 flex items-center gap-3">
				<div
					className="rounded-lg p-2"
					style={{ backgroundColor: `${seedColor}20` }}
				>
					<Palette className="h-6 w-6" style={{ color: seedColor }} />
				</div>
				<h1 className="md-headline-medium">Settings</h1>
			</div>

			{/* Time & Region Settings */}
			<M3Card variant="elevated">
				<M3CardHeader>
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-lg bg-(--md-sys-color-primary-container)">
							<Globe className="w-5 h-5 text-(--md-sys-color-on-primary-container)" />
						</div>
						<div>
							<M3CardTitle>Time & Region</M3CardTitle>
							<M3CardDescription>
								Customize how dates and times are displayed
							</M3CardDescription>
						</div>
					</div>
				</M3CardHeader>
				<M3CardContent className="space-y-6">
					<div className="space-y-3">
						<Label htmlFor={timezoneId} className="md-label-large">
							Timezone
						</Label>
						{isSettingsLoading ? (
							<Skeleton className="h-10 w-full rounded-md" />
						) : (
							<Select
								value={timezone}
								onValueChange={handleTimezoneChange}
								disabled={updateSettingsMutation.isPending}
							>
								<SelectTrigger
									id={timezoneId}
									className="bg-(--md-sys-color-surface-container) border-(--md-sys-color-outline)"
								>
									<SelectValue placeholder="Select timezone" />
								</SelectTrigger>
								<SelectContent className="bg-(--md-sys-color-surface-container) border-(--md-sys-color-outline) max-h-80">
									{TIMEZONE_GROUPS.map((group) => (
										<div key={group.region}>
											<div className="px-2 py-1.5 text-xs font-semibold text-(--md-sys-color-on-surface-variant)">
												{group.region}
											</div>
											{group.zones.map((zone) => (
												<SelectItem
													key={zone}
													value={zone}
													className="text-(--md-sys-color-on-surface) focus:bg-(--md-sys-color-surface-container-high)"
												>
													{zone.replace(/_/g, " ")}
												</SelectItem>
											))}
										</div>
									))}
								</SelectContent>
							</Select>
						)}
					</div>

					<div className="h-px bg-(--md-sys-color-outline-variant)" />

					<div className="space-y-3">
						<div className="flex items-center justify-between gap-2">
							<div className="space-y-0.5">
								<Label className="md-label-large">Time Format</Label>
								<p className="md-body-medium text-(--md-sys-color-on-surface-variant)">
									Use 24-hour format (14:00) instead of 12-hour (2:00 PM)
								</p>
							</div>
							{isSettingsLoading ? (
								<Skeleton className="h-6 w-11 rounded-full" />
							) : (
								<div className="flex items-center gap-3">
									{updateSettingsMutation.isPending && (
										<Loader2
											className="w-4 h-4 animate-spin"
											style={{ color: seedColor }}
										/>
									)}
									<Switch
										checked={is24Hour}
										onCheckedChange={handleTimeFormatToggle}
										disabled={updateSettingsMutation.isPending}
									/>
								</div>
							)}
						</div>
					</div>

					{!isSettingsLoading && (
						<div
							className="mt-4 p-4 rounded-lg border"
							style={{
								backgroundColor: "var(--md-sys-color-surface-container)",
								borderColor: "var(--md-sys-color-outline-variant)",
							}}
						>
							<div className="flex items-center gap-3">
								<Clock className="w-5 h-5" style={{ color: seedColor }} />
								<div>
									<p className="md-body-medium text-(--md-sys-color-on-surface-variant)">
										Current time preview
									</p>
									<p
										className="text-xl font-mono font-semibold"
										style={{ color: seedColor }}
									>
										{getCurrentTimeDisplay()}
									</p>
								</div>
							</div>
						</div>
					)}
				</M3CardContent>
			</M3Card>

			{/* Account Settings */}
			<M3Card variant="elevated">
				<M3CardHeader>
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-lg bg-(--md-sys-color-secondary-container)">
							<User className="w-5 h-5 text-(--md-sys-color-on-secondary-container)" />
						</div>
						<div>
							<M3CardTitle>Account</M3CardTitle>
							<M3CardDescription>
								Manage your account information
							</M3CardDescription>
						</div>
					</div>
				</M3CardHeader>
				<M3CardContent className="space-y-6">
					<div className="px-1 py-2">
						<div className="grid gap-6 lg:grid-cols-[152px_minmax(0,1fr)] lg:items-start">
							<div className="flex flex-col items-center gap-4 lg:pt-2">
								<div
									className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 shadow-sm"
									style={{
										backgroundColor: "var(--md-sys-color-surface-container)",
										borderColor: "var(--md-sys-color-outline-variant)",
									}}
								>
									{avatarPreviewUrl ? (
										<img
											src={avatarPreviewUrl}
											alt={displayName || user.handle}
											className="h-full w-full object-cover"
										/>
									) : (
										<span
											className="text-4xl font-semibold"
											style={{ color: seedColor }}
										>
											{(displayName || user.handle).charAt(0).toUpperCase()}
										</span>
									)}
								</div>
								<div className="space-y-1 text-center">
									<p className="md-title-medium text-(--md-sys-color-on-surface)">
										{displayName || "Your profile"}
									</p>
									<p className="md-body-small text-(--md-sys-color-on-surface-variant)">
										@{user.handle}
									</p>
								</div>
							</div>

							<div className="space-y-6">
								<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
									<div className="space-y-2">
										<Label htmlFor={displayNameId} className="md-label-large">
											Display Name
										</Label>
										<input
											id={displayNameId}
											type="text"
											value={displayName}
											onChange={(event) => setDisplayName(event.target.value)}
											placeholder="How your name appears"
											className="w-full rounded-2xl border border-(--md-sys-color-outline) bg-(--md-sys-color-surface-container) px-4 py-3 text-(--md-sys-color-on-surface)"
										/>
									</div>

									<div className="space-y-2">
										<Label className="md-label-large">Handle</Label>
										<div
											className="flex min-h-[54px] cursor-not-allowed items-center rounded-2xl border px-4 py-3"
											style={{
												backgroundColor:
													"var(--md-sys-color-surface-container)",
												borderColor: "var(--md-sys-color-outline-variant)",
											}}
										>
											<p className="md-body-large break-all text-(--md-sys-color-on-surface)">
												@{user.handle}
											</p>
										</div>
									</div>
								</div>

								<div className="flex justify-start">
									<M3Button
										variant="filled"
										onClick={handleProfileSave}
										disabled={updateProfileMutation.isPending}
									>
										{updateProfileMutation.isPending
											? "Saving..."
											: "Save profile"}
									</M3Button>
								</div>

								<div className="space-y-3">
									<div className="space-y-2">
										<Label className="md-label-large">Profile Photo</Label>
										<div
											className="rounded-2xl border px-4 py-4"
											style={{
												backgroundColor:
													"var(--md-sys-color-surface-container)",
												borderColor: "var(--md-sys-color-outline-variant)",
											}}
										>
											<input
												ref={avatarInputRef}
												type="file"
												accept="image/jpeg,image/png,image/webp"
												onChange={handleAvatarSelection}
												className="block w-full text-sm text-(--md-sys-color-on-surface-variant) file:mr-4 file:rounded-full file:border-0 file:bg-(--md-sys-color-primary-container) file:px-4 file:py-2 file:text-sm file:font-medium file:text-(--md-sys-color-on-primary-container)"
											/>
											<p className="mt-3 md-body-small text-(--md-sys-color-on-surface-variant)">
												{AVATAR_UPLOAD_HELP_TEXT} Choose a square image for the
												cleanest crop.
											</p>
											{avatarErrorMessage ? (
												<p className="mt-2 md-body-small text-(--md-sys-color-error)">
													{avatarErrorMessage}
												</p>
											) : null}
										</div>
									</div>

									<div className="flex flex-wrap gap-2">
										<M3Button
											variant="filled-tonal"
											onClick={handleAvatarUpload}
											disabled={
												!selectedAvatarFile || uploadAvatarMutation.isPending
											}
										>
											<Camera className="mr-2 h-4 w-4" />
											{uploadAvatarMutation.isPending
												? "Uploading..."
												: "Upload picture"}
										</M3Button>
										<M3Button
											variant="text"
											onClick={() => deleteAvatarMutation.mutate({})}
											disabled={
												(!user.avatar && !selectedAvatarFile) ||
												deleteAvatarMutation.isPending
											}
										>
											{deleteAvatarMutation.isPending
												? "Removing..."
												: "Remove existing picture"}
										</M3Button>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="h-px bg-(--md-sys-color-outline-variant)" />

					<div>
						<M3Button
							variant="outlined"
							onClick={() => setShowDeleteDialog(true)}
							className="w-full text-(--md-sys-color-error) border-(--md-sys-color-error) hover:bg-(--md-sys-color-error-container)/10"
						>
							<Trash2 className="w-4 h-4 mr-2" />
							Delete Account
						</M3Button>
					</div>
				</M3CardContent>
			</M3Card>

			{/* Delete Account Dialog */}
			<Dialog
				open={showDeleteDialog}
				onOpenChange={deletionJobId ? undefined : setShowDeleteDialog}
			>
				<DialogContent
					className="bg-(--md-sys-color-surface-container) border-(--md-sys-color-outline)"
					onInteractOutside={
						deletionJobId ? (e) => e.preventDefault() : undefined
					}
				>
					{deletionJobId ? (
						<DeletionProgressView
							job={deletionJobQuery.data}
							error={
								deletionJobQuery.data?.status === "failed"
									? deletionJobQuery.data.lastError
									: undefined
							}
							onRetry={() => {
								setDeletionJobId(null);
								setDeletePDSData(true);
							}}
							seedColor={seedColor}
						/>
					) : (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2 text-(--md-sys-color-on-surface)">
									<AlertTriangle className="w-5 h-5 text-(--md-sys-color-error)" />
									Delete Account
								</DialogTitle>
								<DialogDescription className="text-(--md-sys-color-on-surface-variant)">
									Are you sure you want to delete your account? This action
									cannot be undone.
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-4 py-4">
								<div
									className="p-4 rounded-lg border"
									style={{
										backgroundColor:
											"var(--md-sys-color-surface-container-lowest)",
										borderColor: "var(--md-sys-color-outline-variant)",
									}}
								>
									<p className="md-body-medium text-(--md-sys-color-on-surface-variant) mb-3">
										What happens to your data:
									</p>
									<div className="space-y-2 text-sm">
										<p className="flex items-start gap-2 text-(--md-sys-color-on-surface)">
											<span style={{ color: seedColor }}>✓</span>
											Your OpnShelf account and settings will be deleted
										</p>
										<p className="flex items-start gap-2 text-(--md-sys-color-on-surface)">
											<span style={{ color: seedColor }}>✓</span>
											Your local session will be cleared
										</p>
									</div>
								</div>

								<div
									className="flex items-center gap-3 p-4 rounded-lg border"
									style={{
										backgroundColor:
											"var(--md-sys-color-surface-container-lowest)",
										borderColor: "var(--md-sys-color-outline-variant)",
									}}
								>
									<input
										type="checkbox"
										id={deletePdsId}
										checked={deletePDSData}
										onChange={(e) => setDeletePDSData(e.target.checked)}
										className="w-4 h-4 rounded border-(--md-sys-color-outline) bg-(--md-sys-color-surface-container) accent-(--md-sys-color-primary)"
									/>
									<Label
										htmlFor={deletePdsId}
										className="md-body-medium cursor-pointer text-(--md-sys-color-on-surface)"
									>
										Also delete my OpnShelf data from my PDS
									</Label>
								</div>

								{deletePDSData ? (
									<div
										className="p-3 rounded-lg border"
										style={{
											backgroundColor:
												"color-mix(in srgb, var(--md-sys-color-error) 10%, transparent)",
											borderColor:
												"color-mix(in srgb, var(--md-sys-color-error) 20%, transparent)",
										}}
									>
										<p className="md-body-medium text-(--md-sys-color-error)">
											Your OpnShelf data, including watch history, follows,
											lists, and list items, will be permanently deleted from
											your personal data server. This cannot be recovered.
										</p>
									</div>
								) : (
									<div
										className="p-3 rounded-lg"
										style={{
											backgroundColor: "var(--md-sys-color-surface-container)",
										}}
									>
										<p className="md-body-medium text-(--md-sys-color-on-surface-variant)">
											Your OpnShelf data will remain on your PDS. You can use
											another app or re-authorize OpnShelf later to access it.
										</p>
									</div>
								)}
							</div>

							<DialogFooter className="gap-2">
								<M3Button
									variant="outlined"
									onClick={() => setShowDeleteDialog(false)}
									disabled={deleteAccountMutation.isPending}
								>
									Cancel
								</M3Button>
								<M3Button
									variant="filled"
									className="bg-(--md-sys-color-error) text-(--md-sys-color-on-error) hover:brightness-110 active:brightness-95"
									onClick={() =>
										deleteAccountMutation.mutate({
											body: { deletePDSData },
										})
									}
									disabled={deleteAccountMutation.isPending}
								>
									{deleteAccountMutation.isPending && (
										<Loader2 className="h-4 w-4 animate-spin" />
									)}
									{deleteAccountMutation.isPending
										? "Deleting…"
										: "Delete Account"}
								</M3Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

function DeletionProgressView({
	job,
	error,
	onRetry,
	seedColor,
}: {
	job: AccountDeletionJobDto | null | undefined;
	error: string | undefined;
	onRetry: () => void;
	seedColor: string;
}) {
	const progress = job ? getAccountDeletionProgress(job) : null;
	const stepLabel = job
		? getAccountDeletionStepLabel(job.currentStep)
		: "Preparing…";
	const isFailed = job?.status === "failed";

	return (
		<div className="space-y-6 py-2">
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2 text-(--md-sys-color-on-surface)">
					{isFailed ? (
						<AlertTriangle className="h-5 w-5 text-(--md-sys-color-error)" />
					) : (
						<Loader2
							className="h-5 w-5 animate-spin"
							style={{ color: seedColor }}
						/>
					)}
					{isFailed ? "Deletion Failed" : "Deleting Account…"}
				</DialogTitle>
				<DialogDescription className="text-(--md-sys-color-on-surface-variant)">
					{isFailed
						? "Something went wrong while deleting your account."
						: "Please keep this page open. Your data is being removed."}
				</DialogDescription>
			</DialogHeader>

			{!isFailed && (
				<div className="space-y-3">
					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<p className="md-body-medium text-(--md-sys-color-on-surface-variant)">
								{stepLabel}
							</p>
							{progress !== null && (
								<p
									className="md-label-medium font-mono"
									style={{ color: seedColor }}
								>
									{progress}%
								</p>
							)}
						</div>
						<div
							className="h-2 w-full overflow-hidden rounded-full"
							style={{
								backgroundColor:
									"var(--md-sys-color-surface-container-highest)",
							}}
						>
							<div
								className="h-full rounded-full transition-all duration-300 ease-out"
								style={{
									width: `${progress ?? 0}%`,
									backgroundColor: seedColor,
								}}
							/>
						</div>
					</div>
					{job && job.totalRecords > 0 && (
						<p className="md-body-small text-(--md-sys-color-on-surface-variant)">
							{job.deletedRecords} of {job.totalRecords} records deleted
						</p>
					)}
				</div>
			)}

			{isFailed && (
				<div className="space-y-4">
					<div
						className="rounded-lg border p-3"
						style={{
							backgroundColor:
								"color-mix(in srgb, var(--md-sys-color-error) 10%, transparent)",
							borderColor:
								"color-mix(in srgb, var(--md-sys-color-error) 20%, transparent)",
						}}
					>
						<p className="md-body-medium text-(--md-sys-color-error)">
							{error ??
								"Account deletion failed. Please try again or contact support."}
						</p>
					</div>
					<M3Button variant="filled" onClick={onRetry} className="w-full">
						Retry
					</M3Button>
				</div>
			)}
		</div>
	);
}
