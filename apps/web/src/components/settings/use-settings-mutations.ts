import {
	authControllerPermissions,
	getErrorMessage,
	usersControllerGetMySettingsOptions,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePermissionExplainer } from "#/components/PermissionExplainer";

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
 * scope set. The Permission Explainer says what changes first; continuing
 * leaves the page for the Account Host, which returns to Connections.
 */
export function usePermissionChange() {
	const explainer = usePermissionExplainer();
	const [isPending, setIsPending] = useState(false);

	const requestPermissionChange = async (
		integration: "blog" | "bluesky",
		action: "connect" | "disconnect",
	) => {
		setIsPending(true);
		try {
			const authorizationUrl = await explainer.request({
				integration,
				action,
				start: async () =>
					(
						await authControllerPermissions({
							body: { integration, action },
							throwOnError: true,
						})
					).data.authorizationUrl,
			});
			if (authorizationUrl) {
				window.location.assign(authorizationUrl);
				return;
			}
		} catch (error) {
			toast.error(
				getErrorMessage(error, "Could not start the permission change"),
			);
		}
		setIsPending(false);
	};

	return {
		isPending,
		requestPermissionChange,
		explainerDialog: explainer.dialog,
	};
}

/**
 * How the last permission change for `integration` came back from the
 * Account Host, read once from the URL the backend redirected to.
 */
export function usePermissionChangeReturn(integration: "blog" | "bluesky") {
	const [outcome, setOutcome] = useState<"declined" | "failed" | null>(null);
	useEffect(() => {
		const url = new URL(window.location.href);
		if (url.searchParams.get("integration") !== integration) return;
		const result = url.searchParams.get("permissionChange");
		if (result !== "declined" && result !== "failed") return;
		setOutcome(result);
		url.searchParams.delete("permissionChange");
		url.searchParams.delete("integration");
		window.history.replaceState(
			window.history.state,
			"",
			`${url.pathname}${url.search}${url.hash}`,
		);
	}, [integration]);
	return outcome;
}
