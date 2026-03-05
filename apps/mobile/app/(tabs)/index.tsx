import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DashboardHome } from "@/components/home/DashboardHome";
import { LandingHome } from "@/components/home/LandingHome";
import { Skeleton } from "@/components/ui/Skeleton";
import { spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";

export default function HomeScreen() {
	const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
	const { colors } = useTheme();

	if (isAuthLoading) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top"]}
			>
				<View style={styles.loadingContainer}>
					<Skeleton
						width="100%"
						height={108}
						style={{ marginBottom: spacing.md }}
					/>
					<Skeleton
						width="100%"
						height={108}
						style={{ marginBottom: spacing.md }}
					/>
					<Skeleton width="100%" height={160} />
				</View>
			</SafeAreaView>
		);
	}

	if (!isAuthenticated || !user) {
		return <LandingHome />;
	}

	return <DashboardHome user={user} />;
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	loadingContainer: {
		padding: spacing.lg,
	},
});
