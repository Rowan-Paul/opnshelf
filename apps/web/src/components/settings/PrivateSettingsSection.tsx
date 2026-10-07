import {
	usersControllerDeletePrivateSettingsMutation,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useAuth } from "#/lib/auth-context";
import { IntegrationPermissionRow } from "./IntegrationPermissionRow";
import {
	usePermissionChange,
	useUpdateSettings,
} from "./use-settings-mutations";

export function PrivateSettingsSection() {
	const { userSettings } = useAuth();
	const state = userSettings?.privateSettings;
	const [confirmReconnect, setConfirmReconnect] = useState(false);
	const queryClient = useQueryClient();
	const permissions = usePermissionChange();
	const save = useUpdateSettings();
	const remove = useMutation({
		...usersControllerDeletePrivateSettingsMutation(),
		onSuccess: () => {
			toast.success(
				"Private copy deleted. Your current time format is kept in Opnshelf.",
			);
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMySettingsOptions().queryKey,
			});
		},
		onError: () =>
			toast.error("Could not delete your private copy. Try again."),
	});
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
		<div className="space-y-3 border-(--border) border-t pt-5">
			<Dialog open={confirmReconnect} onOpenChange={setConfirmReconnect}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reconnect Private Settings?</DialogTitle>
						<DialogDescription>
							Other devices will need to sign in again after this permission
							change.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setConfirmReconnect(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={() => {
								setConfirmReconnect(false);
								permissions.requestPermissionChange("spaces", "connect");
							}}
						>
							Continue and reconnect
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<IntegrationPermissionRow
				name="Private Settings"
				description={message}
				connected={state.enabled}
				disabled={
					permissions.isPending ||
					(!state.enabled && state.status !== "available")
				}
				confirmationDescription="Other devices will need to sign in again. Disconnecting keeps your last known time format in Opnshelf and leaves the private copy on your PDS."
				onConfirm={(action) =>
					permissions.requestPermissionChange("spaces", action)
				}
			/>
			{state.enabled && (
				<div className="flex flex-wrap gap-2">
					{state.status === "permissionRequired" && (
						<Button
							variant="outline"
							disabled={permissions.isPending}
							onClick={() => setConfirmReconnect(true)}
						>
							Reconnect Private Settings
						</Button>
					)}
					{state.status === "missing" && (
						<Button
							variant="outline"
							disabled={save.isPending}
							onClick={() =>
								save.mutate({ body: { timeFormat: userSettings.timeFormat } })
							}
						>
							Save current time format
						</Button>
					)}
					{state.status === "connected" && (
						<Button
							variant="outline"
							disabled={remove.isPending}
							onClick={() => remove.mutate({})}
						>
							Delete private copy
						</Button>
					)}
					<Button
						variant="ghost"
						onClick={() =>
							queryClient.invalidateQueries({
								queryKey: usersControllerGetMySettingsOptions().queryKey,
							})
						}
					>
						Check again
					</Button>
				</div>
			)}
		</div>
	);
}
