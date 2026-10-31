import { PERMISSION_DECLINED_MESSAGE } from "@opnshelf/api";
import { usePermissionChangeReturn } from "./use-settings-mutations";

/** "Nothing changed" after the Account Host declined or failed a change. */
export function PermissionChangeOutcome({
	integration,
}: {
	integration: "blog" | "bluesky";
}) {
	const outcome = usePermissionChangeReturn(integration);
	if (!outcome) return null;
	return (
		<output className="mb-4 block rounded-md border border-(--border) bg-(--background-subtle) p-3 text-sm">
			{outcome === "declined"
				? PERMISSION_DECLINED_MESSAGE
				: "Nothing changed. Something went wrong while asking for the permission. Try again."}
		</output>
	);
}
