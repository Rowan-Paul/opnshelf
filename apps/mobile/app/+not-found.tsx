import { usePathname, useRouter } from "expo-router";
import { ArrowLeft, Clapperboard, Home, Search } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

export default function NotFoundScreen() {
	const router = useRouter();
	const pathname = usePathname();
	const { colors } = useTheme();
	const canGoBack = router.canGoBack();

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["top", "bottom"]}
		>
			<View
				pointerEvents="none"
				style={[styles.glowPrimary, { backgroundColor: colors.primary }]}
			/>
			<View
				pointerEvents="none"
				style={[
					styles.glowSecondary,
					{ backgroundColor: colors.primaryContainer },
				]}
			/>

			<View style={styles.content}>
				<View style={styles.hero}>
					<View
						style={[
							styles.badge,
							{
								backgroundColor: "rgba(243, 188, 0, 0.12)",
								borderColor: "rgba(243, 188, 0, 0.28)",
							},
						]}
					>
						<Clapperboard size={16} color={colors.primary} />
						<Text style={[styles.badgeText, { color: colors.primary }]}>
							404 · Route not found
						</Text>
					</View>

					<Text style={[styles.title, { color: colors.onBackground }]}>
						This page slipped off the shelf.
					</Text>
					<Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
						The link you opened does not match a screen in OpnShelf, or it may
						have moved.
					</Text>
				</View>

				<Card
					style={{
						...styles.card,
						backgroundColor: colors.surfaceContainerLow,
						borderColor: colors.outlineVariant,
					}}
				>
					<CardHeader style={styles.cardHeader}>
						<View
							style={[
								styles.iconBadge,
								{ backgroundColor: colors.primaryContainer },
							]}
						>
							<Clapperboard size={28} color={colors.primary} />
						</View>
						<Text style={[styles.cardTitle, { color: colors.onSurface }]}>
							Get back to something worth tracking
						</Text>
						<Text
							style={[
								styles.cardDescription,
								{ color: colors.onSurfaceVariant },
							]}
						>
							Use one of the recovery actions below instead of refreshing a dead
							link.
						</Text>
					</CardHeader>

					<CardContent style={styles.cardContent}>
						<View
							style={[
								styles.pathChip,
								{
									backgroundColor: colors.surfaceContainer,
									borderColor: colors.outlineVariant,
								},
							]}
						>
							<Text
								style={[styles.pathLabel, { color: colors.onSurfaceVariant }]}
							>
								Missing path
							</Text>
							<Text
								numberOfLines={1}
								style={[styles.pathValue, { color: colors.onSurface }]}
							>
								{pathname}
							</Text>
						</View>

						<View style={styles.actions}>
							<Button
								size="lg"
								onPress={() => router.replace("/(tabs)")}
								style={styles.primaryAction}
							>
								<Home
									size={20}
									color={colors.onPrimary}
									style={styles.buttonIcon}
								/>
								<Text
									style={[
										styles.primaryButtonText,
										{ color: colors.onPrimary },
									]}
								>
									Go home
								</Text>
							</Button>

							<Button
								size="lg"
								variant="outlined"
								onPress={() => router.replace("/(tabs)/search")}
								style={styles.secondaryAction}
							>
								<Search
									size={20}
									color={colors.primary}
									style={styles.buttonIcon}
								/>
								<Text
									style={[
										styles.secondaryButtonText,
										{ color: colors.primary },
									]}
								>
									Open search
								</Text>
							</Button>

							{canGoBack ? (
								<Button
									variant="text"
									size="lg"
									onPress={() => router.back()}
									style={styles.tertiaryAction}
								>
									<ArrowLeft
										size={18}
										color={colors.primary}
										style={styles.buttonIcon}
									/>
									<Text
										style={[
											styles.secondaryButtonText,
											{ color: colors.primary },
										]}
									>
										Go back
									</Text>
								</Button>
							) : null}
						</View>

						<View style={styles.recoveryList}>
							<View
								style={[
									styles.recoveryCard,
									{
										backgroundColor: colors.surfaceContainer,
										borderColor: colors.outlineVariant,
									},
								]}
							>
								<Text
									style={[styles.recoveryTitle, { color: colors.onSurface }]}
								>
									Return to the main app
								</Text>
								<Text
									style={[
										styles.recoveryDescription,
										{ color: colors.onSurfaceVariant },
									]}
								>
									Head back to your home screen to pick up your shelf, lists,
									and up next queue.
								</Text>
							</View>

							<View
								style={[
									styles.recoveryCard,
									{
										backgroundColor: colors.surfaceContainer,
										borderColor: colors.outlineVariant,
									},
								]}
							>
								<Text
									style={[styles.recoveryTitle, { color: colors.onSurface }]}
								>
									Search for the title instead
								</Text>
								<Text
									style={[
										styles.recoveryDescription,
										{ color: colors.onSurfaceVariant },
									]}
								>
									Look up the movie, show, season, or episode you were trying to
									open.
								</Text>
							</View>
						</View>
					</CardContent>
				</Card>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	glowPrimary: {
		position: "absolute",
		top: -120,
		left: -40,
		width: 260,
		height: 260,
		borderRadius: 999,
		opacity: 0.16,
	},
	glowSecondary: {
		position: "absolute",
		right: -70,
		bottom: 80,
		width: 220,
		height: 220,
		borderRadius: 999,
		opacity: 0.2,
	},
	content: {
		flex: 1,
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.xl,
		paddingBottom: spacing.lg,
		justifyContent: "center",
	},
	hero: {
		alignItems: "center",
		marginBottom: spacing.lg,
	},
	badge: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		borderWidth: 1,
		borderRadius: borderRadius.full,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		marginBottom: spacing.md,
	},
	badgeText: {
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 0.5,
		textTransform: "uppercase",
	},
	title: {
		fontSize: 34,
		lineHeight: 40,
		fontWeight: "700",
		textAlign: "center",
		marginBottom: spacing.sm,
	},
	subtitle: {
		fontSize: 16,
		lineHeight: 24,
		textAlign: "center",
		maxWidth: 520,
	},
	card: {
		borderWidth: 1,
		borderRadius: borderRadius.xxl,
	},
	cardHeader: {
		alignItems: "center",
		paddingTop: spacing.xl,
	},
	iconBadge: {
		width: 56,
		height: 56,
		borderRadius: borderRadius.full,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: spacing.sm,
	},
	cardTitle: {
		fontSize: 24,
		lineHeight: 30,
		fontWeight: "700",
		textAlign: "center",
		marginBottom: spacing.xs,
	},
	cardDescription: {
		fontSize: 15,
		lineHeight: 22,
		textAlign: "center",
	},
	cardContent: {
		paddingTop: spacing.md,
	},
	pathChip: {
		borderWidth: 1,
		borderRadius: borderRadius.xl,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
		marginBottom: spacing.lg,
	},
	pathLabel: {
		fontSize: 11,
		fontWeight: "700",
		letterSpacing: 1,
		textTransform: "uppercase",
		marginBottom: spacing.xs,
	},
	pathValue: {
		fontSize: 14,
		fontWeight: "600",
	},
	actions: {
		gap: spacing.sm,
		marginBottom: spacing.lg,
	},
	primaryAction: {
		borderRadius: borderRadius.full,
	},
	secondaryAction: {
		borderRadius: borderRadius.full,
	},
	tertiaryAction: {
		alignSelf: "center",
	},
	buttonIcon: {
		marginRight: spacing.sm,
	},
	primaryButtonText: {
		fontSize: 16,
		fontWeight: "700",
	},
	secondaryButtonText: {
		fontSize: 16,
		fontWeight: "600",
	},
	recoveryList: {
		gap: spacing.sm,
	},
	recoveryCard: {
		borderWidth: 1,
		borderRadius: borderRadius.xl,
		padding: spacing.md,
	},
	recoveryTitle: {
		fontSize: 15,
		fontWeight: "700",
		marginBottom: spacing.xs,
	},
	recoveryDescription: {
		fontSize: 14,
		lineHeight: 20,
	},
});
