import {
	authControllerMeOptions,
	authControllerMeQueryKey,
	usersControllerDeleteMyAccountMutation,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertTriangle,
	Clock,
	Globe,
	Loader2,
	Trash2,
	User,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { UnauthenticatedState } from "@/components/UnauthenticatedState";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

const TIMEZONES = [
	{ region: "UTC", zones: ["UTC"] },
	{
		region: "Americas",
		zones: [
			"America/New_York",
			"America/Chicago",
			"America/Denver",
			"America/Los_Angeles",
			"America/Toronto",
			"America/Vancouver",
			"America/Mexico_City",
			"America/Sao_Paulo",
			"America/Buenos_Aires",
		],
	},
	{
		region: "Europe",
		zones: [
			"Europe/London",
			"Europe/Paris",
			"Europe/Berlin",
			"Europe/Rome",
			"Europe/Madrid",
			"Europe/Amsterdam",
			"Europe/Zurich",
			"Europe/Stockholm",
			"Europe/Oslo",
			"Europe/Copenhagen",
			"Europe/Helsinki",
			"Europe/Warsaw",
			"Europe/Prague",
			"Europe/Vienna",
			"Europe/Budapest",
			"Europe/Moscow",
			"Europe/Istanbul",
		],
	},
	{
		region: "Asia & Pacific",
		zones: [
			"Asia/Tokyo",
			"Asia/Seoul",
			"Asia/Shanghai",
			"Asia/Hong_Kong",
			"Asia/Singapore",
			"Asia/Taipei",
			"Asia/Manila",
			"Asia/Bangkok",
			"Asia/Jakarta",
			"Asia/Kuala_Lumpur",
			"Asia/Ho_Chi_Minh",
			"Asia/Dubai",
			"Asia/Mumbai",
			"Asia/Kolkata",
			"Asia/Dhaka",
			"Asia/Karachi",
			"Pacific/Auckland",
			"Pacific/Sydney",
			"Pacific/Melbourne",
			"Pacific/Perth",
		],
	},
	{
		region: "Middle East & Africa",
		zones: [
			"Africa/Cairo",
			"Africa/Johannesburg",
			"Africa/Lagos",
			"Africa/Nairobi",
			"Asia/Jerusalem",
			"Asia/Riyadh",
			"Asia/Tehran",
		],
	},
];

export const Route = createFileRoute("/profile/settings")({
	head: () => ({
		meta: [{ title: "Settings | OpnShelf" }],
	}),
	component: SettingsPage,
});

function SettingsPage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const timezoneId = useId();
	const deletePdsId = useId();

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
		...usersControllerDeleteMyAccountMutation(),
		onSuccess: () => {
			setShowDeleteDialog(false);
			toast.success("Account deleted");
			queryClient.setQueryData(authControllerMeQueryKey(), null);
			queryClient.removeQueries({ queryKey: authControllerMeQueryKey() });
			router.navigate({ to: "/" });
		},
		onError: () => {
			toast.error("Failed to delete account");
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
		return (
			<div className="min-h-screen bg-gray-950 text-gray-50">
				<div className="container mx-auto px-4 py-8 max-w-3xl">
					<div className="flex items-center gap-3 mb-8">
						<Skeleton className="w-8 h-8 rounded" />
						<Skeleton className="w-32 h-8 rounded" />
					</div>
					<Skeleton className="h-64 rounded-xl" />
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<UnauthenticatedState
				title="Settings"
				description="Sign in to customize your preferences"
				icon="settings"
			/>
		);
	}

	return (
		<div className="min-h-screen bg-gray-950 text-gray-50">
			<div className="container mx-auto px-4 py-8 max-w-3xl">
				<Card className="bg-gray-900 border-gray-800">
					<CardHeader>
						<div className="flex items-center gap-3">
							<div className="p-2 bg-amber-500/10 rounded-lg">
								<Globe className="w-5 h-5 text-amber-500" />
							</div>
							<div>
								<CardTitle>Time & Region</CardTitle>
								<CardDescription>
									Customize how dates and times are displayed
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="space-y-3">
							<Label htmlFor={timezoneId} className="text-sm font-medium">
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
										className="bg-gray-950 border-gray-700"
									>
										<SelectValue placeholder="Select timezone" />
									</SelectTrigger>
									<SelectContent className="bg-gray-900 border-gray-700 max-h-80">
										{TIMEZONES.map((group) => (
											<div key={group.region}>
												<div className="px-2 py-1.5 text-xs font-semibold text-gray-500">
													{group.region}
												</div>
												{group.zones.map((zone) => (
													<SelectItem
														key={zone}
														value={zone}
														className="text-gray-300 focus:bg-gray-800 focus:text-gray-100"
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

						<div className="h-px bg-gray-800" />

						<div className="space-y-3">
							<div className="flex items-center justify-between gap-2">
								<div className="space-y-0.5">
									<Label className="text-sm font-medium">Time Format</Label>
									<p className="text-sm text-gray-500">
										Use 24-hour format (14:00) instead of 12-hour (2:00 PM)
									</p>
								</div>
								{isSettingsLoading ? (
									<Skeleton className="h-6 w-11 rounded-full" />
								) : (
									<div className="flex items-center gap-3">
										{updateSettingsMutation.isPending && (
											<Loader2 className="w-4 h-4 animate-spin text-amber-500" />
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
							<div className="mt-4 p-4 bg-gray-950/50 rounded-lg border border-gray-800">
								<div className="flex items-center gap-3">
									<Clock className="w-5 h-5 text-amber-500" />
									<div>
										<p className="text-sm text-gray-500">
											Current time preview
										</p>
										<p className="text-xl font-mono font-semibold text-amber-500">
											{getCurrentTimeDisplay()}
										</p>
									</div>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="bg-gray-900 border-gray-800 mt-6">
					<CardHeader>
						<div className="flex items-center gap-3">
							<div className="p-2 bg-blue-500/10 rounded-lg">
								<User className="w-5 h-5 text-blue-500" />
							</div>
							<div>
								<CardTitle>Account</CardTitle>
								<CardDescription>
									Manage your account information
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium">Handle</p>
								<p className="text-sm text-gray-400">@{user.handle}</p>
							</div>
							{user.displayName && (
								<div className="text-right">
									<p className="text-sm font-medium">Display Name</p>
									<p className="text-sm text-gray-400">
										{String(user.displayName)}
									</p>
								</div>
							)}
						</div>

						<div className="h-px bg-gray-800" />

						<div>
							<Button
								variant="destructive"
								onClick={() => setShowDeleteDialog(true)}
								className="w-full"
							>
								<Trash2 className="w-4 h-4 mr-2" />
								Delete Account
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent className="bg-gray-900 border-gray-800">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="w-5 h-5 text-red-500" />
							Delete Account
						</DialogTitle>
						<DialogDescription className="text-gray-400">
							Are you sure you want to delete your account? This action cannot
							be undone.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="p-4 bg-gray-950 rounded-lg border border-gray-800">
							<p className="text-sm text-gray-400 mb-3">
								What happens to your data:
							</p>
							<div className="space-y-2 text-sm">
								<p className="flex items-start gap-2">
									<span className="text-green-500">✓</span>
									Your OpnShelf account and settings will be deleted
								</p>
								<p className="flex items-start gap-2">
									<span className="text-green-500">✓</span>
									Your local session will be cleared
								</p>
							</div>
						</div>

						<div className="flex items-center gap-3 p-4 bg-gray-950 rounded-lg border border-gray-800">
							<input
								type="checkbox"
								id={deletePdsId}
								checked={deletePDSData}
								onChange={(e) => setDeletePDSData(e.target.checked)}
								className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-red-500 focus:ring-offset-gray-900"
							/>
							<Label htmlFor={deletePdsId} className="text-sm cursor-pointer">
								Also delete my watch history from my PDS
							</Label>
						</div>

						{deletePDSData ? (
							<div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
								<p className="text-sm text-red-400">
									Your watch history will be permanently deleted from your
									personal data server. This cannot be recovered.
								</p>
							</div>
						) : (
							<div className="p-3 bg-gray-800/50 rounded-lg">
								<p className="text-sm text-gray-400">
									Your watch history will remain on your PDS. You can use
									another app or re-authorize OpnShelf later to access it.
								</p>
							</div>
						)}
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowDeleteDialog(false)}
							disabled={deleteAccountMutation.isPending}
						>
							Cancel
						</Button>
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
