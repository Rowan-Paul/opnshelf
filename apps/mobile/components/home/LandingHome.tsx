import { Image } from "expo-image";
import { router } from "expo-router";
import {
	CalendarRange,
	Clock3,
	Database,
	ListChecks,
	LogIn,
	Search,
	ShieldCheck,
	Tv,
} from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

const featureCards = [
	{
		icon: Tv,
		title: "Movie, show, season, episode",
		description:
			"Track at exactly the level you want, from full-series completion down to single episodes.",
	},
	{
		icon: Clock3,
		title: "Full watch history",
		description:
			"Log rewatches, keep each watch date, and build a complete timeline of your viewing activity.",
	},
	{
		icon: ListChecks,
		title: "Powerful list workflows",
		description:
			"Use default lists and custom lists to organize favorites, queues, themes, and deep cuts.",
	},
	{
		icon: Database,
		title: "Import your history",
		description:
			"Import history from a public Trakt username or CSV to start with real data instead of a blank slate.",
	},
	{
		icon: CalendarRange,
		title: "Timezone-aware activity",
		description:
			"Keep your watch dates accurate with timezone and 12h/24h preferences built into your profile.",
	},
	{
		icon: ShieldCheck,
		title: "AT Protocol identity",
		description:
			"Sign in with your Atmosphere account and keep your identity and data model portable across apps.",
	},
];

export function LandingHome() {
	const { colors } = useTheme();

	return (
		<SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={styles.hero}>
					<Image source={require("@/assets/images/icon.png")} style={styles.logo} />
					<View style={[styles.heroBadge, { backgroundColor: colors.secondaryContainer }]}>
						<Text style={[styles.heroBadgeText, { color: colors.onSecondaryContainer }]}>Built for serious tracking</Text>
					</View>
					<Text style={[styles.title, { color: colors.onBackground }]}>Track every watch. Organize every obsession.</Text>
					<Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}> 
						OpnShelf gives you movie and show tracking down to season and episode level, complete watch history, list organization, and a portable AT Protocol account.
					</Text>
					<View style={styles.heroActions}>
						<Button size="lg" onPress={() => router.push("/login")}> 
							<LogIn size={20} color={colors.onPrimary} style={styles.buttonIcon} />
							<Text style={[styles.buttonText, { color: colors.onPrimary }]}>Sign in to start tracking</Text>
						</Button>
						<Button size="lg" variant="outlined" onPress={() => router.push("/(tabs)/search")}> 
							<Search size={20} color={colors.primary} style={styles.buttonIcon} />
							<Text style={[styles.buttonText, { color: colors.primary }]}>Browse catalog</Text>
						</Button>
					</View>
				</View>

				<View style={styles.features}>
					{featureCards.map((feature) => (
						<Card key={feature.title}>
							<CardHeader>
								<feature.icon size={28} color={colors.primary} style={styles.featureIcon} />
								<Text style={[styles.featureTitle, { color: colors.onSurface }]}>{feature.title}</Text>
							</CardHeader>
							<CardContent>
								<Text style={[styles.featureDescription, { color: colors.onSurfaceVariant }]}> 
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
	container: { flex: 1 },
	scrollContent: { padding: spacing.lg },
	hero: { alignItems: "center", paddingTop: spacing.xl, paddingBottom: spacing.lg },
	logo: { width: 100, height: 100, borderRadius: 20, marginBottom: spacing.md },
	heroBadge: {
		borderRadius: borderRadius.full,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.xs,
		marginBottom: spacing.md,
	},
	heroBadgeText: { fontSize: 12, fontWeight: "600" },
	title: { fontSize: 34, fontWeight: "700", marginBottom: spacing.sm, textAlign: "center" },
	subtitle: { fontSize: 16, textAlign: "center", marginBottom: spacing.xl, lineHeight: 24 },
	heroActions: { width: "100%", gap: spacing.sm },
	buttonIcon: { marginRight: spacing.sm },
	buttonText: { fontSize: 16, fontWeight: "600" },
	features: { gap: spacing.md },
	featureIcon: { marginBottom: spacing.sm },
	featureTitle: { fontSize: 18, fontWeight: "600" },
	featureDescription: { fontSize: 14, lineHeight: 20 },
});
