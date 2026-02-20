import type { ColorTheme } from "./types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { borderRadius, spacing } from "@/constants/spacing";

const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w1280";
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

interface DetailHeroProps {
	title: string;
	subtitle?: string;
	backdropUrl?: string | null;
	posterUrl?: string | null;
	colors: ColorTheme;
	onBack: () => void;
	isLoading?: boolean;
	posterLinkTo?: {
		onPress: () => void;
	};
}

export function DetailHero({
	title,
	subtitle,
	backdropUrl,
	posterUrl,
	colors,
	onBack,
	isLoading = false,
	posterLinkTo,
}: DetailHeroProps) {
	const insets = useSafeAreaInsets();

	if (isLoading) {
		return (
			<View style={styles.heroWrapper}>
				<View
					style={[
						styles.backdrop,
						{ backgroundColor: colors.muted || "#1a1a2e" },
					]}
				/>
				<View style={styles.heroOverlay}>
					<View style={styles.posterWrapper}>
						<View
							style={[styles.poster, { backgroundColor: colors.muted }]}
						/>
					</View>
					<View style={styles.titleWrapper}>
						<View
							style={[
								styles.titleSkeleton,
								{ backgroundColor: colors.muted },
							]}
						/>
					</View>
				</View>
			</View>
		);
	}

	const fullBackdropUrl = backdropUrl
		? backdropUrl.startsWith("http")
			? backdropUrl
			: `${BACKDROP_BASE_URL}${backdropUrl}`
		: null;

	const fullPosterUrl = posterUrl
		? posterUrl.startsWith("http")
			? posterUrl
			: `${POSTER_BASE_URL}${posterUrl}`
		: null;

	const posterContent = fullPosterUrl ? (
		<Image
			source={{ uri: fullPosterUrl }}
			style={styles.poster}
			contentFit="cover"
		/>
	) : (
		<View style={[styles.poster, styles.noPoster]}>
			<Text style={styles.noPosterText}>No poster</Text>
		</View>
	);

	return (
		<View style={styles.heroWrapper}>
			{fullBackdropUrl ? (
				<Image
					source={{ uri: fullBackdropUrl }}
					style={styles.backdrop}
					contentFit="cover"
				/>
			) : (
				<View
					style={[
						styles.backdrop,
						{ backgroundColor: colors.muted || "#1a1a2e" },
					]}
				/>
			)}

			<LinearGradient
				colors={[
					"rgba(0,0,0,0.2)",
					"rgba(0,0,0,0.5)",
					"rgba(0,0,0,0)",
				]}
				style={styles.backdropGradient}
			/>

			<TouchableOpacity
				onPress={onBack}
				style={[styles.backButton]}
				activeOpacity={0.8}
			>
				<Ionicons name="arrow-back" size={24} color="#f9fafb" />
			</TouchableOpacity>

			<View style={styles.heroOverlay}>
				{posterLinkTo ? (
					<TouchableOpacity
						onPress={posterLinkTo.onPress}
						activeOpacity={0.8}
						style={[
							styles.posterWrapper,
							{ shadowColor: colors.primary },
						]}
					>
						{posterContent}
					</TouchableOpacity>
				) : (
					<View
						style={[
							styles.posterWrapper,
							{ shadowColor: colors.primary },
						]}
					>
						{posterContent}
					</View>
				)}

				<View style={styles.titleWrapper}>
					<Text
						style={[styles.title, { textShadowColor: colors.primary }]}
						numberOfLines={2}
						adjustsFontSizeToFit
						minimumFontScale={0.7}
					>
						{title}
					</Text>
					{subtitle && (
						<Text style={styles.subtitle} numberOfLines={1}>
							{subtitle}
						</Text>
					)}
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	heroWrapper: {
		height: 280,
		position: "relative",
	},
	backdrop: {
		...StyleSheet.absoluteFillObject,
		width: "100%",
		height: "100%",
	},
	backdropGradient: {
		...StyleSheet.absoluteFillObject,
	},
	backButton: {
		position: "absolute",
		top: spacing.sm,
		left: spacing.md,
		zIndex: 10,
		width: 40,
		height: 40,
		borderRadius: borderRadius.full,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	heroOverlay: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		flexDirection: "row",
		alignItems: "flex-end",
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.md,
	},
	posterWrapper: {
		width: 100,
		height: 150,
		borderRadius: borderRadius.lg,
		overflow: "hidden",
		backgroundColor: "#1f2937",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 8,
		elevation: 8,
	},
	poster: {
		width: "100%",
		height: "100%",
	},
	noPoster: {
		justifyContent: "center",
		alignItems: "center",
	},
	noPosterText: {
		color: "#6b7280",
		fontSize: 12,
	},
	titleWrapper: {
		flex: 1,
		marginLeft: spacing.md,
		marginBottom: spacing.xs,
	},
	title: {
		fontSize: 22,
		fontWeight: "700",
		color: "#f9fafb",
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 8,
	},
	subtitle: {
		fontSize: 15,
		fontWeight: "500",
		color: "#d1d5db",
		marginTop: 4,
	},
	titleSkeleton: {
		height: 24,
		width: "80%",
		borderRadius: borderRadius.sm,
	},
});
