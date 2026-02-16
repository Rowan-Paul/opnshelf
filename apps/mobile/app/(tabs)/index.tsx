import { router } from "expo-router";
import { Film, Search, Share2, Shield } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/contexts/theme";

const features = [
	{
		icon: Film,
		title: "Track Your Media",
		description:
			"Keep track of movies, shows, and games you've watched and played",
	},
	{
		icon: Shield,
		title: "Own Your Data",
		description: "Built on AT Protocol - your data belongs to you",
	},
	{
		icon: Share2,
		title: "Discover & Share",
		description: "See what others are watching and share your favorites",
	},
];

export default function HomeScreen() {
	const { colors } = useTheme();

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["top"]}
		>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={styles.hero}>
					<View style={styles.logoContainer}>
						<Film size={64} color={colors.primary} />
					</View>
					<Text style={[styles.title, { color: colors.onBackground }]}>
						OpnShelf
					</Text>
					<Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
						Your personal media tracker powered by AT Protocol
					</Text>
					<Button
						size="lg"
						onPress={() => router.push("/(tabs)/search")}
						style={styles.searchButton}
					>
						<Search
							size={20}
							color={colors.onPrimary}
							style={styles.buttonIcon}
						/>
						<Text style={[styles.buttonText, { color: colors.onPrimary }]}>
							Search Movies
						</Text>
					</Button>
				</View>

				<View style={styles.features}>
					{features.map((feature, index) => (
						<Card key={index} style={styles.featureCard}>
							<CardHeader>
								<feature.icon
									size={32}
									color={colors.primary}
									style={styles.featureIcon}
								/>
								<Text
									style={[styles.featureTitle, { color: colors.onSurface }]}
								>
									{feature.title}
								</Text>
							</CardHeader>
							<CardContent>
								<Text
									style={[
										styles.featureDescription,
										{ color: colors.onSurfaceVariant },
									]}
								>
									{feature.description}
								</Text>
							</CardContent>
						</Card>
					))}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollContent: {
		padding: spacing.lg,
	},
	hero: {
		alignItems: "center",
		paddingVertical: spacing.xxl,
	},
	logoContainer: {
		marginBottom: spacing.lg,
	},
	title: {
		fontSize: 40,
		fontWeight: "bold",
		marginBottom: spacing.sm,
	},
	subtitle: {
		fontSize: 16,
		textAlign: "center",
		marginBottom: spacing.xl,
		paddingHorizontal: spacing.lg,
	},
	searchButton: {
		minWidth: 200,
	},
	buttonIcon: {
		marginRight: spacing.sm,
	},
	buttonText: {
		fontSize: 16,
		fontWeight: "600",
	},
	features: {
		gap: spacing.md,
	},
	featureCard: {
		marginBottom: spacing.md,
	},
	featureIcon: {
		marginBottom: spacing.sm,
	},
	featureTitle: {
		fontSize: 18,
		fontWeight: "600",
	},
	featureDescription: {
		fontSize: 14,
		lineHeight: 20,
	},
});
