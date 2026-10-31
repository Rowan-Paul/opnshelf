import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

type PermissionAction = "connect" | "disconnect";

/**
 * Connect or disconnect one External Integration. The press goes straight to
 * the Permission Explainer, which says what changes before leaving for the
 * Account Host.
 */
export function IntegrationPermissionRow({
	name,
	description,
	connected,
	disabled = false,
	onRequest,
}: {
	name: string;
	description: string;
	connected: boolean;
	disabled?: boolean;
	onRequest: (action: PermissionAction) => void;
}) {
	return (
		<View className="flex-row items-center gap-3">
			<View className="min-w-0 flex-1 gap-1">
				{connected && (
					<Text className="text-muted-foreground text-sm">Connected</Text>
				)}
				{disabled && !connected && (
					<Text className="text-muted-foreground text-sm leading-5">
						{description}
					</Text>
				)}
			</View>
			<Button
				accessibilityLabel={`${connected ? "Disconnect" : "Connect"} ${name}`}
				label={connected ? "Disconnect" : "Connect"}
				variant={connected ? "secondary" : "primary"}
				size="sm"
				disabled={disabled}
				onPress={() => onRequest(connected ? "disconnect" : "connect")}
			/>
		</View>
	);
}
