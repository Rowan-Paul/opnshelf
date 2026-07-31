import {
	authControllerPermissionsMutation,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/** Shared by every section that writes to /users/me/settings. */
export function useUpdateSettings() {
	const queryClient = useQueryClient();

	return useMutation({
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
}

/**
 * Connecting or disconnecting an integration re-runs OAuth with a different
 * scope set, so success means leaving the page for the authorization URL.
 */
export function usePermissionChange() {
	const mutation = useMutation({
		mutationKey: ["auth", "permissions", "change"],
		...authControllerPermissionsMutation(),
		onSuccess: (result) => {
			window.location.assign(result.authorizationUrl);
		},
		onError: (error) => {
			toast.error(
				error instanceof Error
					? error.message
					: "Could not start the permission change",
			);
		},
	});

	return {
		isPending: mutation.isPending,
		requestPermissionChange: (
			integration: "blog" | "bluesky",
			action: "connect" | "disconnect",
		) => mutation.mutate({ body: { integration, action } }),
	};
}
