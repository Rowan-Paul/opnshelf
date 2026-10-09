import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";

type PermissionAction = "connect" | "disconnect";

export function IntegrationPermissionRow({
	name,
	description,
	connected,
	disabled = false,
	confirmationDescription = "Other devices will need to sign in again after this permission change. Your saved publication and format choices stay in place.",
	onConfirm,
}: {
	name: string;
	description: string;
	connected: boolean;
	disabled?: boolean;
	confirmationDescription?: string;
	onConfirm: (action: PermissionAction) => void;
}) {
	const { showDialog } = useDialog();
	const action: PermissionAction = connected ? "disconnect" : "connect";

	const requestChange = () => {
		showDialog({
			title: `${connected ? "Disconnect" : "Connect"} ${name}?`,
			description: confirmationDescription,
			actions: [
				{ label: "Cancel" },
				{
					label: `Continue and ${action}`,
					variant: action === "disconnect" ? "destructive" : "default",
					onPress: () => onConfirm(action),
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
				onPress={requestChange}
			/>
		</View>
	);
}
