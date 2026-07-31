import { Pressable, View } from "react-native";
import { useDialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";

type PermissionAction = "connect" | "disconnect";

export function IntegrationPermissionRow({
	name,
	description,
	connected,
	disabled = false,
	onConfirm,
}: {
	name: string;
	description: string;
	connected: boolean;
	disabled?: boolean;
	onConfirm: (action: PermissionAction) => void;
}) {
	const { showDialog } = useDialog();
	const action: PermissionAction = connected ? "disconnect" : "connect";

	const requestChange = () => {
		showDialog({
			title: `${connected ? "Disconnect" : "Connect"} ${name}?`,
			description:
				"Other devices will need to sign in again after this permission change. Your saved publication and format choices stay in place.",
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
		<View className="flex-row items-center gap-3 rounded-lg border border-border p-3">
			<View className="min-w-0 flex-1 gap-1">
				<View className="flex-row flex-wrap items-center gap-2">
					<Text className="font-medium text-foreground text-sm">{name}</Text>
					<View
						className={
							connected
								? "rounded-full bg-success/10 px-2 py-0.5"
								: "rounded-full bg-background-subtle px-2 py-0.5"
						}
					>
						<Text
							className={
								connected
									? "font-medium text-success text-xs"
									: "font-medium text-muted-foreground text-xs"
							}
						>
							{connected ? "Connected" : "Not connected"}
						</Text>
					</View>
				</View>
				<Text className="text-muted-foreground text-sm leading-5">
					{description}
				</Text>
			</View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${connected ? "Disconnect" : "Connect"} ${name}`}
				disabled={disabled}
				onPress={requestChange}
				className={
					connected
						? "rounded-lg border border-border px-3 py-2"
						: "rounded-lg bg-primary px-3 py-2"
				}
				style={{ opacity: disabled ? 0.5 : 1 }}
			>
				<Text
					className={
						connected
							? "font-semibold text-foreground text-sm"
							: "font-semibold text-primary-foreground text-sm"
					}
				>
					{connected ? "Disconnect" : "Connect"}
				</Text>
			</Pressable>
		</View>
	);
}
