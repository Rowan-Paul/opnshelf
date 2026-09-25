import { notificationsControllerSettingsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "#/lib/auth-context";
import { startPromptCooldown, useHydrated } from "#/lib/prompt-state";

export function NotificationPrompt() {
	const { user } = useAuth();
	const hydrated = useHydrated();
	const [dismissed, setDismissed] = useState(false);
	const { data } = useQuery({
		...notificationsControllerSettingsOptions(),
		enabled: !!user,
	});
	let snoozed = false;
	const key = `opnshelf.notifications-prompt.${user?.did}`;
	if (hydrated) {
		try {
			snoozed = Number(localStorage.getItem(key)) > Date.now();
		} catch {}
	}
	if (
		!hydrated ||
		!user ||
		!data ||
		data.pushDeviceCount > 0 ||
		dismissed ||
		snoozed
	)
		return null;
	return (
		<section className="rounded-xl border border-(--border) bg-(--background-subtle) p-5 sm:p-6">
			<h2 className="font-semibold text-lg">Don’t miss your next watch</h2>
			<p className="mt-1 text-(--foreground-muted) text-sm">
				Get mobile alerts for Watchlist releases, new seasons and your watch
				stats. Manage mobile and email notifications in Settings.
			</p>
			<div className="mt-4 flex flex-wrap justify-end gap-3">
				<button
					type="button"
					className="btn btn-secondary"
					onClick={() => {
						try {
							localStorage.setItem(key, String(Date.now() + 7 * 86400000));
						} catch {}
						startPromptCooldown();
						setDismissed(true);
					}}
				>
					Remind me later
				</button>
				<Link
					to="/settings/$section"
					params={{ section: "notifications" }}
					className="btn btn-primary"
				>
					Set up notifications
				</Link>
			</div>
		</section>
	);
}
