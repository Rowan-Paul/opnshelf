import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { useAuth } from "@/contexts/auth";

export default function AuthCallbackScreen() {
	const { token } = useLocalSearchParams<{ token?: string }>();
	const { handleAuthCallback } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (token) {
			handleAuthCallback(token).then(() => {
				router.replace("/(tabs)");
			});
		}
	}, [token, handleAuthCallback, router]);

	return (
		<View style={styles.container}>
			<ActivityIndicator size="large" color={colors.primary} />
			<Text style={styles.text}>Completing sign in...</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
		justifyContent: "center",
		alignItems: "center",
		gap: 16,
	},
	text: {
		color: colors.text,
		fontSize: 16,
	},
});
