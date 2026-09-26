import { notificationsControllerSettingsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";

export function NotificationPrompt() {
	const { user } = useAuth();
	const key = `notification-prompt-${user?.did.replaceAll(":", "-")}`;
	const [dismissed, setDismissed] = useState(true);
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
		<View className="gap-3 rounded-xl border border-border bg-card p-4">
			<Text className="font-display font-semibold text-foreground text-lg">
				Don’t miss your next watch
			</Text>
			<Text className="text-muted-foreground text-sm">
				Get mobile alerts for Watchlist releases, new seasons and your watch
				stats. Choose your notifications in Settings.
			</Text>
			<View className="flex-row flex-wrap justify-end gap-2">
				<Button
					label="Remind me later"
					variant="secondary"
					size="sm"
					onPress={() => {
						setDismissed(true);
						void SecureStore.setItemAsync(
							key,
							String(Date.now() + 7 * 86400000),
						).catch(() => {});
					}}
				/>
				<Link href="/settings/notifications" asChild>
					<Button label="Set up notifications" size="sm" />
				</Link>
			</View>
		</View>
	);
}
