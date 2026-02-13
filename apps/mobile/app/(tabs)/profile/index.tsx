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
	User,
} from "lucide-react-native";
import { useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, colors, spacing } from "@/constants/theme";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/contexts/toast";

export default function ProfileScreen() {
	const { user, isLoading: isAuthLoading, isAuthenticated, logout } = useAuth();
	const { showToast } = useToast();

	const { data: profile } = useQuery({
		...authControllerMeOptions(),
		enabled: !!user?.did,
	});

	const handleAuthAction = useCallback(async () => {
		if (isAuthenticated) {
			await logout();
			showToast("Logged out successfully", "success");
		} else {
			router.push("/login");
		}
	}, [isAuthenticated, logout, showToast]);

	if (isAuthLoading) {
		return (
			<SafeAreaView style={styles.container} edges={["top"]}>
				<View style={styles.header}>
					<View style={styles.headerLeft}>
						<User size={32} color={colors.primary} />
						<Text style={styles.title}>Profile</Text>
					</View>
				</View>
				<View style={styles.skeletonContainer}>
					<Skeleton
						width="100%"
						height={120}
						style={{ marginBottom: spacing.lg }}
					/>
					<Skeleton
						width="100%"
						height={80}
						style={{ marginBottom: spacing.md }}
					/>
					<Skeleton width="100%" height={80} />
				</View>
			</SafeAreaView>
		);
	}

	if (!isAuthenticated) {
		return (
			<SafeAreaView style={styles.container} edges={["top"]}>
				<View style={styles.header}>
					<View style={styles.headerLeft}>
						<User size={32} color={colors.primary} />
						<Text style={styles.title}>Profile</Text>
					</View>
					<TouchableOpacity
						onPress={handleAuthAction}
						style={styles.authButton}
					>
						<LogIn size={20} color={colors.text} />
						<Text style={styles.authButtonText}>Sign in</Text>
					</TouchableOpacity>
				</View>
				<View style={styles.centerContent}>
					<Card style={styles.authCard}>
						<CardHeader style={styles.authCardHeader}>
							<User size={64} color={colors.primary} style={styles.authIcon} />
							<Text style={styles.authTitle}>Welcome to OpnShelf</Text>
							<Text style={styles.authDescription}>
								Sign in to track movies and create lists
							</Text>
						</CardHeader>
						<CardContent>
							<Button size="lg" onPress={() => router.push("/login")}>
								<LogIn
									size={20}
									color={colors.text}
									style={styles.buttonIcon}
								/>
								<Text style={styles.buttonText}>Sign in</Text>
							</Button>
						</CardContent>
					</Card>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container} edges={["top"]}>
			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<User size={32} color={colors.primary} />
					<Text style={styles.title}>Profile</Text>
				</View>
				<View style={styles.headerRight}>
					<TouchableOpacity
						onPress={() => router.push("/settings")}
						style={styles.iconButton}
					>
						<Settings size={20} color={colors.text} />
					</TouchableOpacity>
					<TouchableOpacity
						onPress={handleAuthAction}
						style={styles.authButton}
					>
						<LogOut size={20} color={colors.text} />
						<Text style={styles.authButtonText}>Logout</Text>
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
						<View style={styles.avatar}>
							<Text style={styles.avatarText}>
								{String(profile?.displayName)?.[0] ||
									profile?.handle?.[0] ||
									"U"}
							</Text>
						</View>
					)}
					<View style={styles.profileInfo}>
						<Text style={styles.displayName}>
							{String(profile?.displayName || profile?.handle || "User")}
						</Text>
						{profile?.displayName && (
							<Text style={styles.handle}>@{profile.handle}</Text>
						)}
					</View>
				</CardHeader>
			</Card>

			{/* Navigation Links */}
			<View style={styles.linksContainer}>
				<TouchableOpacity
					style={styles.linkCard}
					onPress={() => router.push("/(tabs)/profile/shelf")}
				>
					<View style={styles.linkIconContainer}>
						<BookOpen size={24} color={colors.primary} />
					</View>
					<View style={styles.linkContent}>
						<Text style={styles.linkTitle}>My Shelf</Text>
						<Text style={styles.linkDescription}>
							Movies you&apos;ve watched
						</Text>
					</View>
					<Text style={styles.linkArrow}>→</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.linkCard}
					onPress={() => router.push("/(tabs)/profile/lists")}
				>
					<View style={styles.linkIconContainer}>
						<List size={24} color={colors.primary} />
					</View>
					<View style={styles.linkContent}>
						<Text style={styles.linkTitle}>My Lists</Text>
						<Text style={styles.linkDescription}>Custom movie collections</Text>
					</View>
					<Text style={styles.linkArrow}>→</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
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
		color: colors.text,
	},
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	iconButton: {
		padding: spacing.sm,
		backgroundColor: colors.card,
		borderRadius: borderRadius.md,
	},
	authButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		backgroundColor: colors.card,
		borderRadius: borderRadius.md,
	},
	authButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.text,
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
		color: colors.text,
		textAlign: "center",
		marginBottom: spacing.sm,
	},
	authDescription: {
		fontSize: 16,
		color: colors.textMuted,
		textAlign: "center",
	},
	buttonIcon: {
		marginRight: spacing.sm,
	},
	buttonText: {
		color: colors.text,
		fontSize: 16,
		fontWeight: "600",
	},
	skeletonContainer: {
		padding: spacing.lg,
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
		backgroundColor: colors.primary,
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
		color: colors.text,
	},
	profileInfo: {
		flex: 1,
	},
	displayName: {
		fontSize: 20,
		fontWeight: "bold",
		color: colors.text,
	},
	handle: {
		fontSize: 14,
		color: colors.textMuted,
		marginTop: spacing.xs,
	},
	linksContainer: {
		paddingHorizontal: spacing.lg,
		gap: spacing.md,
	},
	linkCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.card,
		borderRadius: borderRadius.lg,
		padding: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
	},
	linkIconContainer: {
		width: 48,
		height: 48,
		borderRadius: borderRadius.md,
		backgroundColor: `${colors.primary}20`,
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
		color: colors.text,
	},
	linkDescription: {
		fontSize: 12,
		color: colors.textMuted,
		marginTop: spacing.xs,
	},
	linkArrow: {
		fontSize: 20,
		color: colors.textMuted,
	},
});
