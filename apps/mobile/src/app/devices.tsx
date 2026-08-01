import {
	authControllerListDevicesOptions,
	authControllerListDevicesQueryKey,
	authControllerRevokeDeviceMutation,
	authControllerRevokeOtherDevicesMutation,
	type DeviceDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { Laptop, LogOut, Smartphone, Tablet } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { useDialog } from "@/components/ui/dialog";
import { Screen } from "@/components/ui/screen";
import { ListRowsSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime } from "@/lib/relative-time";

function DeviceIcon({ platform }: { platform: string | null }) {
	const Icon =
		platform === "ios" || platform === "android"
			? Smartphone
			: platform === "web"
				? Laptop
				: Tablet;
	return <Icon color="#94a3b8" size={20} />;
}

export default function DevicesScreen() {
	const queryClient = useQueryClient();
	const toast = useToast();
	const { showDialog } = useDialog();

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

	const confirmRevokeOne = (device: DeviceDto) =>
		showDialog({
			title: "Sign out this device?",
			description: `${device.name ?? "Unknown device"} will need to sign in again.`,
			actions: [
				{ label: "Cancel" },
				{
					label: "Sign out",
					variant: "destructive",
					onPress: () =>
						revokeOne.mutate({ path: { deviceId: device.deviceId } }),
				},
			],
		});

	const confirmRevokeOthers = () =>
		showDialog({
			title: "Sign out all other devices?",
			description:
				"Every device except this one will need to sign in again. This one stays signed in.",
			actions: [
				{ label: "Cancel" },
				{
					label: "Sign out others",
					variant: "destructive",
					onPress: () => revokeOthers.mutate({}),
				},
			],
		});

	const others = devices?.filter((device) => !device.isCurrent) ?? [];
	const busy = revokeOne.isPending || revokeOthers.isPending;

	return (
		<>
			<Stack.Screen options={{ headerShown: true, title: "Devices" }} />
			<Screen topInset={false}>
				<ScrollView
					className="flex-1"
					contentContainerClassName="gap-4 px-4 py-4 pb-12"
					showsVerticalScrollIndicator={false}
				>
					<Text className="text-muted-foreground text-sm leading-5">
						Everywhere you're signed in. Sign out any device you don't
						recognise.
					</Text>

					{isLoading ? (
						<ListRowsSkeleton rows={3} />
					) : isError ? (
						<ErrorState message="Could not load your devices." />
					) : (
						<View className="gap-3">
							{devices?.map((device) => (
								<View
									key={device.deviceId}
									className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4"
								>
									<DeviceIcon platform={device.platform} />
									<View className="flex-1 gap-0.5">
										<Text className="font-medium text-foreground">
											{device.name ?? "Unknown device"}
										</Text>
										<Text className="text-muted-foreground text-xs">
											{device.isCurrent
												? "This device"
												: `Last used ${formatRelativeTime(device.lastUsedAt)}`}
										</Text>
									</View>
									{device.isCurrent ? (
										<View className="rounded-full bg-background-subtle px-2.5 py-1">
											<Text className="text-muted-foreground text-xs">
												This device
											</Text>
										</View>
									) : (
										<Pressable
											accessibilityLabel={`Sign out ${device.name ?? "unknown device"}`}
											accessibilityRole="button"
											disabled={busy}
											onPress={() => confirmRevokeOne(device)}
											className="rounded-lg border border-destructive/40 px-3 py-2"
										>
											<Text className="font-medium text-destructive text-sm">
												Sign out
											</Text>
										</Pressable>
									)}
								</View>
							))}

							{others.length > 0 ? (
								<Pressable
									accessibilityRole="button"
									disabled={busy}
									onPress={confirmRevokeOthers}
									className="flex-row items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
								>
									<LogOut color="#ef4444" size={18} />
									<Text className="font-medium text-destructive">
										Sign out all other devices
									</Text>
								</Pressable>
							) : null}
						</View>
					)}
				</ScrollView>
			</Screen>
		</>
	);
}
