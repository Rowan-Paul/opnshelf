import {
	authControllerListDevicesOptions,
	authControllerListDevicesQueryKey,
	authControllerRevokeDeviceMutation,
	authControllerRevokeOtherDevicesMutation,
	type DeviceDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, LogOut, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { RowListSkeleton } from "#/components/skeletons";
import { Button } from "#/components/ui/button";
import { formatRelativeTime } from "#/lib/date-utils";

export function DevicesSection() {
	const queryClient = useQueryClient();
	const {
		data: devices,
		isLoading,
		isError,
	} = useQuery(authControllerListDevicesOptions());

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: authControllerListDevicesQueryKey(),
		});

	const revokeOne = useMutation({
		mutationKey: ["devices", "revoke"],
		...authControllerRevokeDeviceMutation(),
		onSuccess: async () => {
			await invalidate();
			toast.success("Device signed out");
		},
		onError: () => toast.error("Could not sign out that device."),
	});

	const revokeOthers = useMutation({
		mutationKey: ["devices", "revokeOthers"],
		...authControllerRevokeOtherDevicesMutation(),
		onSuccess: async (result) => {
			await invalidate();
			toast.success(
				result.revoked === 1
					? "1 device signed out"
					: `${result.revoked} devices signed out`,
			);
		},
		onError: () => toast.error("Could not sign out your other devices."),
	});

	const busy = revokeOne.isPending || revokeOthers.isPending;
	const others = devices?.filter((device) => !device.isCurrent) ?? [];

	// ponytail: native confirm rather than a Dialog state machine — signing out a
	// device is recoverable by signing in again. Swap in <Dialog> if the copy
	// needs to explain more than one line.
	const confirmRevokeOne = (device: DeviceDto) => {
		if (
			window.confirm(
				`Sign out ${device.name ?? "this device"}? It will need to sign in again.`,
			)
		) {
			revokeOne.mutate({ path: { deviceId: device.deviceId } });
		}
	};

	const confirmRevokeOthers = () => {
		if (
			window.confirm(
				"Sign out all other devices? This one stays signed in; every other device will need to sign in again.",
			)
		) {
			revokeOthers.mutate({});
		}
	};

	return (
		<section className="border-(--border) border-b p-5 sm:p-7">
			<h2 className="font-semibold text-lg">Devices</h2>
			<p className="mt-1 mb-4 text-(--foreground-muted) text-sm">
				Everywhere you're signed in. Sign out any device you don't recognise.
			</p>

			{isLoading ? (
				<RowListSkeleton rows={3} />
			) : isError ? (
				<p className="text-(--foreground-muted) text-sm">
					Could not load your devices.
				</p>
			) : (
				<div className="space-y-3">
					{devices?.map((device) => (
						<DeviceRow
							key={device.deviceId}
							device={device}
							disabled={busy}
							onRevoke={() => confirmRevokeOne(device)}
						/>
					))}

					{others.length > 0 && (
						<Button
							variant="outline"
							disabled={busy}
							onClick={confirmRevokeOthers}
							className="w-full text-red-600 dark:text-red-400"
						>
							<LogOut className="mr-2 size-4" />
							Sign out all other devices
						</Button>
					)}
				</div>
			)}
		</section>
	);
}

function DeviceRow({
	device,
	disabled,
	onRevoke,
}: {
	device: DeviceDto;
	disabled: boolean;
	onRevoke: () => void;
}) {
	const Icon = device.platform === "web" ? Laptop : Smartphone;
	return (
		<div className="flex items-center gap-3 rounded-lg border border-(--border) p-3">
			<Icon className="size-5 shrink-0 text-(--foreground-muted)" />
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-sm">
					{device.name ?? "Unknown device"}
				</p>
				<p className="text-(--foreground-muted) text-xs">
					{device.isCurrent
						? "This device"
						: `Last used ${formatRelativeTime(device.lastUsedAt)}`}
				</p>
			</div>
			{device.isCurrent ? (
				<span className="rounded-full bg-(--background-subtle) px-2.5 py-1 text-(--foreground-muted) text-xs">
					This device
				</span>
			) : (
				<Button
					variant="outline"
					size="sm"
					disabled={disabled}
					onClick={onRevoke}
					aria-label={`Sign out ${device.name ?? "unknown device"}`}
					className="text-red-600 dark:text-red-400"
				>
					Sign out
				</Button>
			)}
		</div>
	);
}
