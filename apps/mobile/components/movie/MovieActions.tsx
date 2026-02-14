import type { TmdbMovieDetailDto, UserDto } from "@opnshelf/api";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { borderRadius, colors, spacing } from "@/constants/theme";
import { Button } from "@/components/ui/Button";

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
				<Button
					style={{ backgroundColor: movieColors.primary }}
				>
					Sign in to Track
				</Button>
			</View>
		);
	}

	if (!isWatched) {
		return (
			<View style={styles.actionsContainer}>
				<Button
					onPress={onMarkWatched}
					isLoading={isPending}
					style={{ backgroundColor: movieColors.primary }}
				>
					<View style={styles.buttonContent}>
						<Ionicons name="add" size={20} color="#f9fafb" />
						<Text style={styles.buttonText}>Add to Shelf</Text>
					</View>
				</Button>
			</View>
		);
	}

	return (
		<View style={styles.actionsContainer}>
			<Button
				onPress={onMarkWatched}
				isLoading={isPending}
				style={{ backgroundColor: movieColors.primary }}
			>
				<View style={styles.buttonContent}>
					<Ionicons name="checkmark" size={20} color="#f9fafb" />
					<Text style={styles.buttonText}>On Your Shelf</Text>
				</View>
			</Button>
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
