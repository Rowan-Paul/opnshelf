import { authControllerMeOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
	BookOpen,
	List,
	LogIn,
	LogOut,
	Settings,
	Tv,
	User,
} from "lucide-react-native";
import { usePostHog } from "posthog-react-native";
import { useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { borderRadius, spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";

export default function ProfileScreen() {
	const { user, isAuthenticated, logout } = useAuth();
	const { showToast } = useToast();
	const { colors } = useTheme();
	const posthog = usePostHog();

	const { data: profile } = useQuery({
		...authControllerMeOptions(),
		enabled: !!user?.did,
	});

	const handleAuthAction = useCallback(async () => {
		if (isAuthenticated) {
			posthog.capture("user_logged_out");
			posthog.reset();
			await logout();
			showToast("Logged out successfully", "success");
		} else {
			router.push("/login");
		}
	}, [isAuthenticated, logout, showToast, posthog]);

	if (!isAuthenticated) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top"]}
			>
				<View style={styles.header}>
					<View style={styles.headerLeft}>
						<User size={32} color={colors.primary} />
						<Text style={[styles.title, { color: colors.onBackground }]}>
							Profile
						</Text>
					</View>
					<TouchableOpacity
						onPress={handleAuthAction}
						style={[
							styles.authButton,
							{ backgroundColor: colors.surfaceContainer },
						]}
					>
						<LogIn size={20} color={colors.onSurface} />
						<Text style={[styles.authButtonText, { color: colors.onSurface }]}>
							Sign in
						</Text>
					</TouchableOpacity>
				</View>
				<View style={styles.centerContent}>
					<Card style={styles.authCard}>
						<CardHeader style={styles.authCardHeader}>
							<User size={64} color={colors.primary} style={styles.authIcon} />
							<Text style={[styles.authTitle, { color: colors.onSurface }]}>
								Welcome to OpnShelf
							</Text>
							<Text
								style={[
									styles.authDescription,
									{ color: colors.onSurfaceVariant },
								]}
							>
								Sign in to track movies and create lists
							</Text>
						</CardHeader>
						<CardContent>
							<Button size="lg" onPress={() => router.push("/login")}>
								<LogIn
									size={20}
									color={colors.onPrimary}
									style={styles.buttonIcon}
								/>
								<Text style={[styles.buttonText, { color: colors.onPrimary }]}>
									Sign in
								</Text>
							</Button>
						</CardContent>
					</Card>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["top"]}
		>
			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<User size={32} color={colors.primary} />
					<Text style={[styles.title, { color: colors.onBackground }]}>
						Profile
					</Text>
				</View>
				<View style={styles.headerRight}>
					<TouchableOpacity
						onPress={() => router.push("/settings")}
						style={[
							styles.iconButton,
							{ backgroundColor: colors.surfaceContainer },
						]}
					>
						<Settings size={20} color={colors.onSurface} />
					</TouchableOpacity>
					<TouchableOpacity
						onPress={handleAuthAction}
						style={[
							styles.authButton,
							{ backgroundColor: colors.surfaceContainer },
						]}
					>
						<LogOut size={20} color={colors.onSurface} />
						<Text style={[styles.authButtonText, { color: colors.onSurface }]}>
							Logout
						</Text>
					</TouchableOpacity>
				</View>
			</View>

			{/* User Profile Card */}
			<Card style={styles.profileCard}>
				<CardHeader style={styles.profileHeader}>
					{profile?.avatar ? (
						<Image
							source={{ uri: String(profile.avatar) }}
							style={styles.avatarImage}
						/>
					) : (
						<View style={[styles.avatar, { backgroundColor: colors.primary }]}>
							<Text style={[styles.avatarText, { color: colors.onPrimary }]}>
								{String(profile?.displayName)?.[0] ||
									profile?.handle?.[0] ||
									"U"}
							</Text>
						</View>
					)}
					<View style={styles.profileInfo}>
						<Text style={[styles.displayName, { color: colors.onSurface }]}>
							{String(profile?.displayName || profile?.handle || "User")}
						</Text>
						{profile?.displayName && (
							<Text style={[styles.handle, { color: colors.onSurfaceVariant }]}>
								@{profile.handle}
							</Text>
						)}
					</View>
				</CardHeader>
			</Card>

			{/* Navigation Links */}
			<View style={styles.linksContainer}>
				<TouchableOpacity
					style={[
						styles.linkCard,
						{
							backgroundColor: colors.surfaceContainer,
							borderColor: colors.outline,
						},
					]}
					onPress={() => router.push("/(tabs)/profile/shelf")}
				>
					<View
						style={[
							styles.linkIconContainer,
							{ backgroundColor: `${colors.primary}20` },
						]}
					>
						<BookOpen size={24} color={colors.primary} />
					</View>
					<View style={styles.linkContent}>
						<Text style={[styles.linkTitle, { color: colors.onSurface }]}>
							My Shelf
						</Text>
						<Text
							style={[
								styles.linkDescription,
								{ color: colors.onSurfaceVariant },
							]}
						>
							Items added to your shelf
						</Text>
					</View>
					<Text style={[styles.linkArrow, { color: colors.onSurfaceVariant }]}>
						→
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[
						styles.linkCard,
						{
							backgroundColor: colors.surfaceContainer,
							borderColor: colors.outline,
						},
					]}
					onPress={() => router.push("/(tabs)/profile/up-next")}
				>
					<View
						style={[
							styles.linkIconContainer,
							{ backgroundColor: `${colors.primary}20` },
						]}
					>
						<Tv size={24} color={colors.primary} />
					</View>
					<View style={styles.linkContent}>
						<Text style={[styles.linkTitle, { color: colors.onSurface }]}>
							Up Next
						</Text>
						<Text
							style={[
								styles.linkDescription,
								{ color: colors.onSurfaceVariant },
							]}
						>
							The next episodes in your queue
						</Text>
					</View>
					<Text style={[styles.linkArrow, { color: colors.onSurfaceVariant }]}>
						→
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={[
						styles.linkCard,
						{
							backgroundColor: colors.surfaceContainer,
							borderColor: colors.outline,
						},
					]}
					onPress={() => router.push("/(tabs)/profile/lists")}
				>
					<View
						style={[
							styles.linkIconContainer,
							{ backgroundColor: `${colors.primary}20` },
						]}
					>
						<List size={24} color={colors.primary} />
					</View>
					<View style={styles.linkContent}>
						<Text style={[styles.linkTitle, { color: colors.onSurface }]}>
							My Lists
						</Text>
						<Text
							style={[
								styles.linkDescription,
								{ color: colors.onSurfaceVariant },
							]}
						>
							Custom lists of items
						</Text>
					</View>
					<Text style={[styles.linkArrow, { color: colors.onSurfaceVariant }]}>
						→
					</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	headerLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	title: {
		fontSize: 28,
		fontWeight: "bold",
	},
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	iconButton: {
		padding: spacing.sm,
		borderRadius: borderRadius.md,
	},
	authButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.md,
	},
	authButtonText: {
		fontSize: 14,
		fontWeight: "600",
	},
	centerContent: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: spacing.xl,
	},
	authCard: {
		width: "100%",
		maxWidth: 400,
		alignItems: "center",
	},
	authCardHeader: {
		alignItems: "center",
	},
	authIcon: {
		marginBottom: spacing.md,
	},
	authTitle: {
		fontSize: 24,
		fontWeight: "bold",
		textAlign: "center",
		marginBottom: spacing.sm,
	},
	authDescription: {
		fontSize: 16,
		textAlign: "center",
	},
	buttonIcon: {
		marginRight: spacing.sm,
	},
	buttonText: {
		fontSize: 16,
		fontWeight: "600",
	},
	profileCard: {
		marginHorizontal: spacing.lg,
		marginBottom: spacing.lg,
	},
	profileHeader: {
		flexDirection: "row",
		alignItems: "center",
	},
	avatar: {
		width: 64,
		height: 64,
		borderRadius: 32,
		justifyContent: "center",
		alignItems: "center",
		marginRight: spacing.md,
	},
	avatarImage: {
		width: 64,
		height: 64,
		borderRadius: 32,
		marginRight: spacing.md,
	},
	avatarText: {
		fontSize: 28,
		fontWeight: "bold",
	},
	profileInfo: {
		flex: 1,
	},
	displayName: {
		fontSize: 20,
		fontWeight: "bold",
	},
	handle: {
		fontSize: 14,
		marginTop: spacing.xs,
	},
	linksContainer: {
		paddingHorizontal: spacing.lg,
		gap: spacing.md,
	},
	linkCard: {
		flexDirection: "row",
		alignItems: "center",
		borderRadius: borderRadius.lg,
		padding: spacing.md,
		borderWidth: 1,
	},
	linkIconContainer: {
		width: 48,
		height: 48,
		borderRadius: borderRadius.md,
		justifyContent: "center",
		alignItems: "center",
	},
	linkContent: {
		flex: 1,
		marginLeft: spacing.md,
	},
	linkTitle: {
		fontSize: 16,
		fontWeight: "600",
	},
	linkDescription: {
		fontSize: 12,
		marginTop: spacing.xs,
	},
	linkArrow: {
		fontSize: 20,
	},
});
