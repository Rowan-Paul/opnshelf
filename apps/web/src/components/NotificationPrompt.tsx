import { notificationsControllerSettingsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useState } from "react";
import { PromptCard } from "#/components/PromptCard";
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
		<PromptCard
			icon={Bell}
			title="Don’t miss your next watch"
			actions={
				<>
					<button
						type="button"
						className="btn btn-ghost"
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
				</>
			}
		>
			Get mobile alerts for Watchlist releases, new seasons and your watch
			stats. Manage mobile and email notifications in Settings.
		</PromptCard>
	);
}
