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
import { borderRadius, colors, spacing } from "@/constants/theme";
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
	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={onClose}
		>
			<Pressable style={styles.overlay} onPress={onClose}>
				<Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
					<View style={styles.iconContainer}>
						<Ionicons name="warning" size={32} color={colors.error} />
					</View>
					<Text style={styles.title}>{title}</Text>
					<Text style={styles.description}>{description}</Text>
					<View style={styles.buttons}>
						<Button variant="outline" onPress={onClose} style={styles.button}>
							<Text style={styles.buttonOutlineText}>{cancelText}</Text>
						</Button>
						<Button
							onPress={onConfirm}
							disabled={isLoading}
							style={styles.button}
						>
							{isLoading ? (
								<ActivityIndicator size="small" color={colors.text} />
							) : (
								<Text style={styles.buttonText}>{confirmText}</Text>
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
		backgroundColor: colors.card,
		borderRadius: borderRadius.lg,
		padding: spacing.lg,
		alignItems: "center",
	},
	iconContainer: {
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: `${colors.error}20`,
		justifyContent: "center",
		alignItems: "center",
		marginBottom: spacing.md,
	},
	title: {
		fontSize: 20,
		fontWeight: "bold",
		color: colors.text,
		marginBottom: spacing.sm,
		textAlign: "center",
	},
	description: {
		fontSize: 14,
		color: colors.textMuted,
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
		color: colors.text,
	},
	buttonOutlineText: {
		fontSize: 16,
		fontWeight: "600",
		color: colors.text,
	},
});
