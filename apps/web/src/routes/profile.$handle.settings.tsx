import {
	authControllerMeOptions,
	authControllerMeQueryKey,
	usersControllerDeleteMyAccountMutation,
	usersControllerGetMySettingsOptions,
	usersControllerGetPublicProfileOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { usePostHog } from "@posthog/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import {
	AlertTriangle,
	Clock,
	Globe,
	Loader2,
	Palette,
	Trash2,
	User,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
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
import { LoadingButton } from "@/components/ui/loading-button";
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
import { getProfileRoute, isOwnerProfile } from "@/lib/profile-routes";
import { TIMEZONE_GROUPS } from "@/lib/timezones";

export const Route = createFileRoute("/profile/$handle/settings")({
	beforeLoad: async ({ context, params }) => {
		const handle = params.handle.trim().replace(/^@/, "").toLowerCase();
		const [currentUser, profile] = await Promise.all([
			context.queryClient
				.ensureQueryData({
					...authControllerMeOptions(),
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
	const posthog = usePostHog();

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

	useEffect(() => {
		if (settings) {
			setTimezone(settings.timezone);
			setIs24Hour(settings.timeFormat === "24h");
		}
	}, [settings]);

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

	const deleteAccountMutation = useMutation({
		mutationKey: ["users", "account", "delete"],
		...usersControllerDeleteMyAccountMutation(),
		onSuccess: () => {
			posthog.capture("account_deleted", {
				deleted_pds_data: deletePDSData,
			});
			posthog.reset();
			setShowDeleteDialog(false);
			toast.success("Account deleted");
			queryClient.setQueryData(authControllerMeQueryKey(), null);
			queryClient.removeQueries({ queryKey: authControllerMeQueryKey() });
			router.navigate({ to: "/" });
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, "Failed to delete account"));
		},
	});

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
		<div className="max-w-3xl space-y-6 text-[var(--md-sys-color-on-surface)]">
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
						<div className="p-2 rounded-lg bg-[var(--md-sys-color-primary-container)]">
							<Globe className="w-5 h-5 text-[var(--md-sys-color-on-primary-container)]" />
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
									className="bg-[var(--md-sys-color-surface-container)] border-[var(--md-sys-color-outline)]"
								>
									<SelectValue placeholder="Select timezone" />
								</SelectTrigger>
								<SelectContent className="bg-[var(--md-sys-color-surface-container)] border-[var(--md-sys-color-outline)] max-h-80">
									{TIMEZONE_GROUPS.map((group) => (
										<div key={group.region}>
											<div className="px-2 py-1.5 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">
												{group.region}
											</div>
											{group.zones.map((zone) => (
												<SelectItem
													key={zone}
													value={zone}
													className="text-[var(--md-sys-color-on-surface)] focus:bg-[var(--md-sys-color-surface-container-high)]"
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

					<div className="h-px bg-[var(--md-sys-color-outline-variant)]" />

					<div className="space-y-3">
						<div className="flex items-center justify-between gap-2">
							<div className="space-y-0.5">
								<Label className="md-label-large">Time Format</Label>
								<p className="md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
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
									<p className="md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
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
						<div className="p-2 rounded-lg bg-[var(--md-sys-color-secondary-container)]">
							<User className="w-5 h-5 text-[var(--md-sys-color-on-secondary-container)]" />
						</div>
						<div>
							<M3CardTitle>Account</M3CardTitle>
							<M3CardDescription>
								Manage your account information
							</M3CardDescription>
						</div>
					</div>
				</M3CardHeader>
				<M3CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="md-label-large">Handle</p>
							<p className="md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
								@{user.handle}
							</p>
						</div>
						{user.displayName && (
							<div className="text-right">
								<p className="md-label-large">Display Name</p>
								<p className="md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
									{String(user.displayName)}
								</p>
							</div>
						)}
					</div>

					<div className="h-px bg-[var(--md-sys-color-outline-variant)]" />

					<div>
						<M3Button
							variant="outlined"
							onClick={() => setShowDeleteDialog(true)}
							className="w-full text-[var(--md-sys-color-error)] border-[var(--md-sys-color-error)] hover:bg-[var(--md-sys-color-error-container)]/10"
						>
							<Trash2 className="w-4 h-4 mr-2" />
							Delete Account
						</M3Button>
					</div>
				</M3CardContent>
			</M3Card>

			{/* Delete Account Dialog */}
			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent className="bg-[var(--md-sys-color-surface-container)] border-[var(--md-sys-color-outline)]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
							<AlertTriangle className="w-5 h-5 text-[var(--md-sys-color-error)]" />
							Delete Account
						</DialogTitle>
						<DialogDescription className="text-[var(--md-sys-color-on-surface-variant)]">
							Are you sure you want to delete your account? This action cannot
							be undone.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div
							className="p-4 rounded-lg border"
							style={{
								backgroundColor: "var(--md-sys-color-surface-container-lowest)",
								borderColor: "var(--md-sys-color-outline-variant)",
							}}
						>
							<p className="md-body-medium text-[var(--md-sys-color-on-surface-variant)] mb-3">
								What happens to your data:
							</p>
							<div className="space-y-2 text-sm">
								<p className="flex items-start gap-2 text-[var(--md-sys-color-on-surface)]">
									<span style={{ color: seedColor }}>✓</span>
									Your OpnShelf account and settings will be deleted
								</p>
								<p className="flex items-start gap-2 text-[var(--md-sys-color-on-surface)]">
									<span style={{ color: seedColor }}>✓</span>
									Your local session will be cleared
								</p>
							</div>
						</div>

						<div
							className="flex items-center gap-3 p-4 rounded-lg border"
							style={{
								backgroundColor: "var(--md-sys-color-surface-container-lowest)",
								borderColor: "var(--md-sys-color-outline-variant)",
							}}
						>
							<input
								type="checkbox"
								id={deletePdsId}
								checked={deletePDSData}
								onChange={(e) => setDeletePDSData(e.target.checked)}
								className="w-4 h-4 rounded border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container)] accent-[var(--md-sys-color-primary)]"
							/>
							<Label
								htmlFor={deletePdsId}
								className="md-body-medium cursor-pointer text-[var(--md-sys-color-on-surface)]"
							>
								Also delete my OpnShelf data from my PDS
							</Label>
						</div>

						{deletePDSData ? (
							<div
								className="p-3 rounded-lg border"
								style={{
									backgroundColor: "rgba(var(--md-sys-color-error), 0.1)",
									borderColor: "rgba(var(--md-sys-color-error), 0.2)",
								}}
							>
								<p className="md-body-medium text-[var(--md-sys-color-error)]">
									Your OpnShelf data, including watch history, follows, lists,
									and list items, will be permanently deleted from your personal
									data server. This cannot be recovered.
								</p>
							</div>
						) : (
							<div
								className="p-3 rounded-lg"
								style={{
									backgroundColor: "var(--md-sys-color-surface-container)",
								}}
							>
								<p className="md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
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
						<LoadingButton
							variant="destructive"
							onClick={() =>
								deleteAccountMutation.mutate({
									body: { deletePDSData },
								})
							}
							disabled={deleteAccountMutation.isPending}
							isLoading={deleteAccountMutation.isPending}
						>
							Delete Account
						</LoadingButton>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
