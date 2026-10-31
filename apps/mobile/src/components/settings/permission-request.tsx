import {
	PERMISSION_REQUEST_COPY,
	PERMISSION_REQUEST_NOTES,
	type PermissionRequestIntegration,
} from "@opnshelf/api";
import { Check, Laptop, X } from "lucide-react-native";
import { useCallback } from "react";
import { View } from "react-native";
import { useDialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/theme/colors";

function PermissionRequestBody({
	integration,
}: {
	integration: PermissionRequestIntegration;
}) {
	const colors = useThemeColors();
	const copy = PERMISSION_REQUEST_COPY[integration];

	return (
		<View className="gap-3">
			<View className="gap-1.5">
				<Text className="font-semibold text-foreground text-sm">
					Opnshelf will be able to
				</Text>
				{copy.can.map((line) => (
					<View key={line} className="flex-row gap-2">
						<Check color={colors.success} size={16} />
						<Text className="flex-1 text-foreground text-sm leading-5">
							{line}
						</Text>
					</View>
				))}
			</View>
			<View className="gap-1.5">
				<Text className="font-semibold text-foreground text-sm">
					It still can't
				</Text>
				{copy.cannot.map((line) => (
					<View key={line} className="flex-row gap-2">
						<X color={colors.mutedForeground} size={16} />
						<Text className="flex-1 text-muted-foreground text-sm leading-5">
							{line}
						</Text>
					</View>
				))}
			</View>
			<View className="flex-row items-center gap-2">
				<Laptop color={colors.mutedForeground} size={16} />
				<Text className="flex-1 text-muted-foreground text-xs leading-4">
					{PERMISSION_REQUEST_NOTES.devices}
				</Text>
			</View>
		</View>
	);
}

/**
 * Explains a permission before the in-app browser opens the account host's
 * consent screen. Resolves true only after the dialog has fully dismissed, so
 * the browser session never competes with the closing modal.
 */
export function usePermissionRequest() {
	const { showDialog } = useDialog();

	return useCallback(
		(integration: PermissionRequestIntegration) =>
			new Promise<boolean>((resolve) => {
				showDialog({
					title: PERMISSION_REQUEST_COPY[integration].title,
					description: PERMISSION_REQUEST_NOTES.host,
					body: <PermissionRequestBody integration={integration} />,
					onCancel: () => resolve(false),
					actions: [
						{
							label: "Not now",
							onPress: () => resolve(false),
							variant: "ghost",
						},
						{
							label: "Continue",
							variant: "default",
							onDismiss: () => resolve(true),
						},
					],
				});
			}),
		[showDialog],
	);
}
