import type { TmdbMovieDetailDto, UserDto } from "@opnshelf/api";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, colors, spacing } from "@/constants/theme";

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
	onOpenDateModal,
	onShare,
	onUnmarkWatched,
}: MovieActionsProps) {
	const movieColors = {
		primary: "#8b5cf6",
		accent: "#a855f7",
		muted: "#4c1d95",
	};

	if (!user) {
		return (
			<View style={styles.actionsContainer}>
				<TouchableOpacity
					style={[styles.primaryButton, { backgroundColor: movieColors.primary }]}
					activeOpacity={0.8}
				>
					<Text style={styles.buttonText}>Sign in to Track</Text>
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
					style={[
						styles.primaryButton,
						{
							backgroundColor: movieColors.primary,
							opacity: isPending ? 0.7 : 1,
						},
					]}
					activeOpacity={0.8}
				>
					{isPending ? (
						<ActivityIndicator color="#f9fafb" />
					) : (
						<View style={styles.buttonContent}>
							<Ionicons name="add" size={20} color="#f9fafb" />
							<Text style={styles.buttonText}>Add to Shelf</Text>
						</View>
				)}
			</TouchableOpacity>
			<TouchableOpacity
					onPress={onOpenDateModal}
					style={styles.secondaryButton}
					activeOpacity={0.8}
				>
					<View style={styles.buttonContent}>
						<Ionicons name="calendar" size={18} color="#9ca3af" />
						<Text style={styles.secondaryButtonText}>Add on Different Date</Text>
					</View>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={onShare}
					style={styles.secondaryButton}
					activeOpacity={0.8}
				>
					<View style={styles.buttonContent}>
						<Ionicons
							name="share-outline"
							size={18}
							color="#9ca3af"
						/>
						<Text style={styles.secondaryButtonText}>Share</Text>
					</View>
				</TouchableOpacity>
			</View>
		);
	}

	return (
		<View style={styles.actionsContainer}>
			<TouchableOpacity
				onPress={onMarkWatched}
				disabled={isPending}
				style={[
					styles.primaryButton,
					{ backgroundColor: movieColors.primary },
				]}
				activeOpacity={0.8}
			>
				{isPending ? (
					<ActivityIndicator color="#f9fafb" />
				) : (
					<View style={styles.buttonContent}>
						<Ionicons name="checkmark" size={20} color="#f9fafb" />
						<Text style={styles.buttonText}>On Your Shelf</Text>
					</View>
				)}
			</TouchableOpacity>
			<TouchableOpacity
				onPress={onShare}
				style={styles.secondaryButton}
				activeOpacity={0.8}
			>
				<View style={styles.buttonContent}>
					<Ionicons name="share-outline" size={18} color="#9ca3af" />
					<Text style={styles.secondaryButtonText}>Share</Text>
				</View>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	actionsContainer: {
		gap: spacing.sm,
		marginTop: spacing.lg,
	},
	primaryButton: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		paddingVertical: spacing.md,
		borderRadius: borderRadius.md,
		gap: spacing.sm,
	},
	buttonContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	buttonText: {
		color: "#f9fafb",
		fontSize: 16,
		fontWeight: "600",
	},
	secondaryButton: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		paddingVertical: spacing.md,
		backgroundColor: colors.card,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		borderColor: colors.border,
	},
	secondaryButtonText: {
		color: "#9ca3af",
		fontSize: 14,
		fontWeight: "500",
	},
});
