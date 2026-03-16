import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/contexts/theme";
import { getDisplayName, getOptionalString } from "@/components/social/social-display";

export function SocialUserAvatar({
	avatar,
	displayName,
	handle,
	size = 52,
}: {
	avatar: unknown;
	displayName: unknown;
	handle: string;
	size?: number;
}) {
	const { colors } = useTheme();
	const avatarUrl = getOptionalString(avatar);
	const resolvedName = getDisplayName(displayName, handle);

	if (avatarUrl) {
		return (
			<Image
				source={{ uri: avatarUrl }}
				style={{ width: size, height: size, borderRadius: size / 2 }}
			/>
		);
	}

	return (
		<View
			style={[
				styles.fallback,
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					backgroundColor: colors.primary,
				},
			]}
		>
			<Text style={[styles.initial, { color: colors.onPrimary }]}>
				{resolvedName.charAt(0).toUpperCase() || "?"}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	fallback: {
		alignItems: "center",
		justifyContent: "center",
	},
	initial: {
		fontSize: 20,
		fontWeight: "700",
	},
});
