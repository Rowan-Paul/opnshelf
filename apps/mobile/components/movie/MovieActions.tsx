import type { TmdbMovieDetailDto, UserDto } from "@opnshelf/api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";

interface MovieActionsProps {
	movie: TmdbMovieDetailDto | null;
	user: UserDto | null | undefined;
	isWatched: boolean;
	isPending: boolean;
	onMarkWatched: () => void;
	onOpenDateModal: () => void;
	onShare: () => void;
	onUnmarkWatched: () => void;
}

export function MovieActions({
	movie,
	user,
	isWatched,
	isPending,
	onMarkWatched,
}: MovieActionsProps) {
	const movieColors = movie?.colors || {
		primary: "#F59E0B",
		secondary: "#D97706",
		accent: "#FBBF24",
		muted: "#92400E",
	};

	if (!user) {
		return (
			<View style={styles.actionsContainer}>
				<TouchableOpacity style={styles.button} activeOpacity={0.8}>
				<LinearGradient
					colors={[
						movieColors.primary || "#F59E0B",
						movieColors.secondary || "#D97706",
					]}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}
					style={styles.gradient}
				>
					<Text style={styles.buttonText}>Sign in to Track</Text>
				</LinearGradient>
				</TouchableOpacity>
			</View>
		);
	}

	if (!isWatched) {
		return (
			<View style={styles.actionsContainer}>
				<TouchableOpacity
					onPress={onMarkWatched}
					disabled={isPending}
					style={[styles.button, { opacity: isPending ? 0.7 : 1 }]}
					activeOpacity={0.8}
				>
				<LinearGradient
					colors={[
						movieColors.primary || "#F59E0B",
						movieColors.secondary || "#D97706",
					]}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}
					style={styles.gradient}
				>
					{isPending ? (
						<View style={styles.buttonContent}>
							<ActivityIndicator color="#3f2e00" />
							<Text style={styles.buttonText}>Loading</Text>
						</View>
					) : (
						<View style={styles.buttonContent}>
							<Ionicons name="add" size={20} color="#3f2e00" />
							<Text style={styles.buttonText}>Add to Shelf</Text>
						</View>
					)}
				</LinearGradient>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<View style={styles.actionsContainer}>
			<TouchableOpacity
				onPress={onMarkWatched}
				disabled={isPending}
				style={[styles.button, { opacity: isPending ? 0.7 : 1 }]}
				activeOpacity={0.8}
			>
			<LinearGradient
				colors={[
					movieColors.primary || "#F59E0B",
					movieColors.secondary || "#D97706",
				]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={styles.gradient}
			>
				{isPending ? (
					<View style={styles.buttonContent}>
						<ActivityIndicator color="#3f2e00" />
						<Text style={styles.buttonText}>Loading</Text>
					</View>
				) : (
					<View style={styles.buttonContent}>
						<Ionicons name="checkmark" size={20} color="#3f2e00" />
						<Text style={styles.buttonText}>On Your Shelf</Text>
					</View>
				)}
			</LinearGradient>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	actionsContainer: {
		gap: spacing.sm,
		marginTop: spacing.lg,
	},
	button: {
		borderRadius: borderRadius.md,
		overflow: "hidden",
	},
	gradient: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		paddingVertical: spacing.md,
		paddingHorizontal: spacing.lg,
	},
	buttonContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	buttonText: {
		color: "#3f2e00",
		fontSize: 16,
		fontWeight: "600",
	},
});
