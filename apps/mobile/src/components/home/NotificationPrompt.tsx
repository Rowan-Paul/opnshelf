import { notificationsControllerSettingsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Bell } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	PromptCard,
	PromptSlotItem,
	usePromptCooldown,
} from "@/components/home/prompt-slot";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export function NotificationPrompt() {
	const { user } = useAuth();
	const key = `notification-prompt-${user?.did.replaceAll(":", "-")}`;
	const [dismissed, setDismissed] = useState(true);
	const startCooldown = usePromptCooldown();
	const { data } = useQuery({
		...notificationsControllerSettingsOptions(),
		enabled: !!user,
	});
	useEffect(() => {
		let active = true;
		setDismissed(true);
		void SecureStore.getItemAsync(key)
			.then((until) => {
				if (active) setDismissed(Number(until) > Date.now());
			})
			.catch(() => {
				if (active) setDismissed(false);
			});
		return () => {
			active = false;
		};
	}, [key]);
	if (!user || !data || data.pushDeviceCount > 0 || dismissed) return null;
	return (
		<PromptSlotItem id="notification">
			<PromptCard
				icon={Bell}
				title="Don’t miss your next watch"
				actions={
					<>
						<Button
							label="Remind me later"
							variant="ghost"
							size="sm"
							onPress={() => {
								setDismissed(true);
								void SecureStore.setItemAsync(
									key,
									String(Date.now() + 7 * 86400000),
								).catch(() => {});
								startCooldown();
							}}
						/>
						<Link href="/settings/notifications" asChild>
							<Button label="Set up notifications" size="sm" />
						</Link>
					</>
				}
			>
				Get mobile alerts for Watchlist releases, new seasons and your watch
				stats. Choose your notifications in Settings.
			</PromptCard>
		</PromptSlotItem>
	);
}
