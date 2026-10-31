import {
	authControllerPermissionsMutation,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
			integration: "blog" | "bluesky" | "spaces" | "watches",
			action: "connect" | "disconnect",
		) => mutation.mutate({ body: { integration, action } }),
	};
}

/**
 * A declined or failed permission change returns to Connections with
 * `?permission=declined|failed`. Say so once, then drop the marker.
 */
export function usePermissionChangeResult(enabled: boolean) {
	useEffect(() => {
		if (!enabled) return;
		const url = new URL(window.location.href);
		const result = url.searchParams.get("permission");
		if (result !== "declined" && result !== "failed") return;
		url.searchParams.delete("permission");
		window.history.replaceState({}, "", url.toString());
		if (result === "declined")
			toast.message("Nothing changed", {
				description:
					"The permission wasn't granted. You can try again any time.",
			});
		else toast.error("Could not finish the permission change. Try again.");
	}, [enabled]);
}
