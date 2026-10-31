import {
	PERMISSION_DISCONNECT_DESCRIPTION,
	type PermissionRequestIntegration,
} from "@opnshelf/api";
import { View } from "react-native";
import { usePermissionRequest } from "@/components/settings/permission-request";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";

type PermissionAction = "connect" | "disconnect";

export function IntegrationPermissionRow({
	integration,
	name,
	description,
	connected,
	disabled = false,
	onConfirm,
}: {
	integration: PermissionRequestIntegration;
	name: string;
	description: string;
	connected: boolean;
	disabled?: boolean;
	onConfirm: (action: PermissionAction) => void;
}) {
	const { showDialog } = useDialog();
	const requestPermission = usePermissionRequest();

	const requestChange = async () => {
		if (!connected) {
			if (await requestPermission(integration)) onConfirm("connect");
			return;
		}
		showDialog({
			title: `Disconnect ${name}?`,
			description: PERMISSION_DISCONNECT_DESCRIPTION,
			actions: [
				{ label: "Cancel" },
				{
					label: "Continue and disconnect",
					variant: "destructive",
					onPress: () => onConfirm("disconnect"),
				},
			],
		});
	};

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
				onPress={() => void requestChange()}
			/>
		</View>
	);
}
