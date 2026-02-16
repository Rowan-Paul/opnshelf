import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { Button } from "@/components/ui/Button";

interface ConfirmModalProps {
	visible: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	description: string;
	confirmText?: string;
	cancelText?: string;
	isLoading?: boolean;
}

export const ConfirmModal = memo(function ConfirmModal({
	visible,
	onClose,
	onConfirm,
	title,
	description,
	confirmText = "Confirm",
	cancelText = "Cancel",
	isLoading = false,
}: ConfirmModalProps) {
	const { colors } = useTheme();

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={onClose}
		>
			<Pressable style={styles.overlay} onPress={onClose}>
				<Pressable style={[styles.content, { backgroundColor: colors.surfaceContainer }]} onPress={(e) => e.stopPropagation()}>
					<View style={[styles.iconContainer, { backgroundColor: `${colors.error}20` }]}>
						<Ionicons name="warning" size={32} color={colors.error} />
					</View>
					<Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
					<Text style={[styles.description, { color: colors.onSurfaceVariant }]}>{description}</Text>
					<View style={styles.buttons}>
						<Button variant="outlined" onPress={onClose} style={styles.button}>
							<Text style={[styles.buttonOutlineText, { color: colors.onSurface }]}>{cancelText}</Text>
						</Button>
						<Button
							onPress={onConfirm}
							disabled={isLoading}
							style={styles.button}
						>
							{isLoading ? (
								<ActivityIndicator size="small" color={colors.onPrimary} />
							) : (
								<Text style={[styles.buttonText, { color: colors.onPrimary }]}>{confirmText}</Text>
							)}
						</Button>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
});

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		padding: spacing.lg,
	},
	content: {
		borderRadius: borderRadius.lg,
		padding: spacing.lg,
		alignItems: "center",
	},
	iconContainer: {
		width: 56,
		height: 56,
		borderRadius: 28,
		justifyContent: "center",
		alignItems: "center",
		marginBottom: spacing.md,
	},
	title: {
		fontSize: 20,
		fontWeight: "bold",
		marginBottom: spacing.sm,
		textAlign: "center",
	},
	description: {
		fontSize: 14,
		textAlign: "center",
		marginBottom: spacing.lg,
	},
	buttons: {
		flexDirection: "row",
		gap: spacing.sm,
		width: "100%",
	},
	button: {
		flex: 1,
	},
	buttonText: {
		fontSize: 16,
		fontWeight: "600",
	},
	buttonOutlineText: {
		fontSize: 16,
		fontWeight: "600",
	},
});
