import type { ReactNode } from "react";
import {
	StyleSheet,
	TouchableOpacity,
	type StyleProp,
	type ViewStyle,
	View,
} from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";

interface MediaCardProps {
	onPress: () => void;
	children: ReactNode;
	media: ReactNode;
	mediaOverlay?: ReactNode;
	cardStyle?: StyleProp<ViewStyle>;
	mediaContainerStyle?: StyleProp<ViewStyle>;
	contentStyle?: StyleProp<ViewStyle>;
	activeOpacity?: number;
}

export function MediaCard({
	onPress,
	children,
	media,
	mediaOverlay,
	cardStyle,
	mediaContainerStyle,
	contentStyle,
	activeOpacity = 0.8,
}: MediaCardProps) {
	return (
		<TouchableOpacity
			onPress={onPress}
			style={[styles.card, cardStyle]}
			activeOpacity={activeOpacity}
		>
			<View style={styles.row}>
				<View style={[styles.mediaContainer, mediaContainerStyle]}>
					<View style={styles.mediaFill}>{media}</View>
					{mediaOverlay}
				</View>
				<View style={[styles.content, contentStyle]}>{children}</View>
			</View>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	card: {
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		overflow: "hidden",
	},
	row: {
		flexDirection: "row",
		alignItems: "stretch",
	},
	mediaContainer: {
		width: 88,
		minHeight: 132,
		alignSelf: "stretch",
		flexShrink: 0,
		position: "relative",
		overflow: "hidden",
	},
	mediaFill: {
		...StyleSheet.absoluteFillObject,
	},
	content: {
		flex: 1,
		padding: spacing.md,
		justifyContent: "space-between",
	},
});
