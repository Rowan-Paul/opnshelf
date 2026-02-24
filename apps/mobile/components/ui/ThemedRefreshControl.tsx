import { RefreshControl } from "react-native";
import { useTheme } from "@/contexts/theme";

interface ThemedRefreshControlProps {
	refreshing: boolean;
	onRefresh: () => void;
}

export function ThemedRefreshControl({
	refreshing,
	onRefresh,
}: ThemedRefreshControlProps) {
	const { colors } = useTheme();

	return (
		<RefreshControl
			refreshing={refreshing}
			onRefresh={onRefresh}
			tintColor={colors.primary}
			colors={[colors.primary]}
			progressBackgroundColor={colors.surfaceContainerHigh}
		/>
	);
}
