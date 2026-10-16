import { View } from "react-native";
export function UnreadDot() {
	return (
		<View
			accessibilityLabel="Unread release notes"
			accessibilityRole="image"
			className="size-2 rounded-full bg-primary"
		/>
	);
}
