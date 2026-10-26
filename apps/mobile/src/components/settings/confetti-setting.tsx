import { useState } from "react";
import { Switch, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import {
	setConfettiEnabled,
	useConfettiPreference,
} from "@/lib/confetti-preference";
export function ConfettiSetting() {
	const enabled = useConfettiPreference();
	const [saving, setSaving] = useState(false);
	const toast = useToast();
	return (
		<View className="mt-6 flex-row items-center justify-between gap-4">
			<View className="flex-1">
				<Text className="font-medium text-foreground text-sm">
					Completion confetti
				</Text>
				<Text className="text-muted-foreground text-sm">
					Celebrate completed Seasons and Shows on this device
				</Text>
			</View>
			{enabled === null ? (
				<View className="h-8 w-12 rounded-full bg-background-subtle" />
			) : (
				<Switch
					accessibilityLabel="Completion confetti"
					value={enabled}
					disabled={saving}
					trackColor={{ false: "#334155", true: "#f2c40d" }}
					thumbColor="#fff"
					onValueChange={(next) => {
						setSaving(true);
						void setConfettiEnabled(next)
							.catch(() =>
								toast.error(
									"Couldn't save the confetti preference. Please try again.",
								),
							)
							.finally(() => setSaving(false));
					}}
				/>
			)}
		</View>
	);
}
