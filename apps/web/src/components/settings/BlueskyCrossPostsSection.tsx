import { IntegrationPermissionRow } from "#/components/settings/IntegrationPermissionRow";
import { useAuth } from "#/lib/auth-context";
import { usePermissionChange } from "./use-settings-mutations";

export function BlueskyCrossPostsSection() {
	const { userSettings } = useAuth();
	const { requestPermissionChange, isPending } = usePermissionChange();

	return (
		<section className="border-(--border) border-b p-5 sm:p-7">
			<h2 className="font-semibold text-lg">Bluesky Cross-posts</h2>
			<p className="mt-1 mb-4 text-(--foreground-muted) text-sm">
				Connect once, then choose which Reviews should also appear on Bluesky
				when you publish them.
			</p>
			<IntegrationPermissionRow
				name="Bluesky Cross-posts"
				description="Allow Opnshelf to post to Bluesky for Reviews you explicitly select."
				connected={userSettings?.blueskyCrossPostEnabled ?? false}
				disabled={isPending}
				onConfirm={(action) => requestPermissionChange("bluesky", action)}
			/>
		</section>
	);
}
