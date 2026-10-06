import {
	type UserSettingsDto,
	usersControllerDeletePrivateSettingsMutation,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { IntegrationPermissionRow } from "./integration-permission-row";

export function PrivateSettingsSection({
	settings,
	permissionPending,
	onPermissionChange,
}: {
	settings?: UserSettingsDto;
	permissionPending: boolean;
	onPermissionChange: (action: "connect" | "disconnect") => void;
}) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const { showDialog } = useDialog();
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: usersControllerGetMySettingsOptions().queryKey,
		});
	const save = useMutation({
		...usersControllerUpdateMySettingsMutation(),
		onSuccess: refresh,
		onError: () =>
			toast.error("Could not save your private setting. Try again."),
	});
	const remove = useMutation({
		...usersControllerDeletePrivateSettingsMutation(),
		onSuccess: () => {
			toast.success(
				"Private copy deleted. Your current time format is kept in Opnshelf.",
			);
			refresh();
		},
		onError: () =>
			toast.error("Could not delete your private copy. Try again."),
	});
	const state = settings?.privateSettings;
	if (!state || (state.status === "disabled" && !state.enabled)) return null;
	const message =
		state.status === "connected"
			? "Your time format is read from your private Space."
			: state.status === "missing"
				? "No private copy yet. Save your current time format to create one."
				: state.status === "permissionRequired"
					? "Access needs renewing. Reconnect to continue saving privately."
					: state.status === "unsupported"
						? "Your PDS does not support Spaces yet."
						: state.status === "unavailable" || state.status === "disabled"
							? "Private Settings are unavailable. Your last known time format is shown."
							: "Save your time format privately on a compatible PDS. This experimental feature is optional.";
	return (
		<View className="gap-3 border-border border-t pt-5">
			<IntegrationPermissionRow
				name="Private Settings"
				description={message}
				connected={state.enabled}
				disabled={
					permissionPending || (!state.enabled && state.status !== "available")
				}
				confirmationDescription="Other devices will need to sign in again. Disconnecting keeps your last known time format in Opnshelf and leaves the private copy on your PDS."
				onConfirm={onPermissionChange}
			/>
			{state.enabled && (
				<View className="gap-2">
					{state.status === "permissionRequired" && (
						<Button
							variant="secondary"
							label="Reconnect Private Settings"
							disabled={permissionPending}
							onPress={() =>
								showDialog({
									title: "Reconnect Private Settings?",
									description:
										"Other devices will need to sign in again after this permission change.",
									actions: [
										{ label: "Cancel" },
										{
											label: "Continue and reconnect",
											onPress: () => onPermissionChange("connect"),
										},
									],
								})
							}
						/>
					)}
					{state.status === "missing" && (
						<Button
							variant="secondary"
							label="Save current time format"
							disabled={save.isPending}
							onPress={() =>
								save.mutate({ body: { timeFormat: settings.timeFormat } })
							}
						/>
					)}
					{state.status === "connected" && (
						<Button
							variant="secondary"
							label="Delete private copy"
							disabled={remove.isPending}
							onPress={() => remove.mutate({})}
						/>
					)}
					<Button variant="secondary" label="Check again" onPress={refresh} />
				</View>
			)}
		</View>
	);
}
