import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";

export default function AuthCallbackScreen() {
	const { token } = useLocalSearchParams<{ token?: string }>();
	const { handleAuthCallback } = useAuth();
	const router = useRouter();
	const { colors } = useTheme();

	useEffect(() => {
		if (token) {
			handleAuthCallback(token).then(() => {
				router.replace("/(tabs)");
			});
		}
	}, [token, handleAuthCallback, router]);

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<ActivityIndicator size="large" color={colors.primary} />
			<Text style={[styles.text, { color: colors.onSurface }]}>
				Completing sign in...
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		gap: 16,
	},
	text: {
		fontSize: 16,
	},
});
