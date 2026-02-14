import {
	listsControllerCreateListMutation,
	listsControllerGetUserListsQueryKey,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, memo, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { borderRadius, colors, spacing } from "@/constants/theme";
import { Button } from "@/components/ui/Button";

interface CreateListModalProps {
	visible: boolean;
	onClose: () => void;
}

export const CreateListModal = memo(function CreateListModal({
	visible,
	onClose,
}: CreateListModalProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const queryClient = useQueryClient();

	const createListMutation = useMutation({
		...listsControllerCreateListMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			setName("");
			setDescription("");
			onClose();
		},
	});

	const handleSubmit = useCallback(() => {
		if (!name.trim()) return;

		createListMutation.mutate({
			body: {
				name: name.trim(),
				description: description.trim() || undefined,
			},
		});
	}, [createListMutation, name, description]);

	const handleClose = useCallback(() => {
		setName("");
		setDescription("");
		onClose();
	}, [onClose]);

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent={true}
			onRequestClose={handleClose}
		>
			<Pressable style={styles.overlay} onPress={handleClose}>
				<Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
					<View style={styles.header}>
						<Text style={styles.title}>Create New List</Text>
						<Pressable onPress={handleClose} hitSlop={8}>
							<Ionicons name="close" size={24} color={colors.text} />
						</Pressable>
					</View>
					<Text style={styles.description}>
						Create a custom list to organize your movies.
					</Text>

					<View style={styles.form}>
						<View style={styles.inputContainer}>
							<Text style={styles.label}>Name</Text>
							<TextInput
								style={styles.input}
								placeholder="My Awesome List"
								placeholderTextColor={colors.textSecondary}
								value={name}
								onChangeText={setName}
								maxLength={100}
							/>
						</View>

						<View style={styles.inputContainer}>
							<Text style={styles.label}>Description (optional)</Text>
							<TextInput
								style={[styles.input, styles.textArea]}
								placeholder="What's this list about?"
								placeholderTextColor={colors.textSecondary}
								value={description}
								onChangeText={setDescription}
								maxLength={500}
								multiline
								numberOfLines={3}
								textAlignVertical="top"
							/>
						</View>

						<View style={styles.buttons}>
							<Button
								variant="outline"
								onPress={handleClose}
								style={styles.button}
							>
								<Text style={styles.buttonOutlineText}>Cancel</Text>
							</Button>
							<Button
								onPress={handleSubmit}
								disabled={!name.trim() || createListMutation.isPending}
								style={styles.button}
							>
								{createListMutation.isPending ? (
									<ActivityIndicator size="small" color={colors.text} />
								) : (
									<Text style={styles.buttonText}>Create</Text>
								)}
							</Button>
						</View>
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
		padding: spacing.md,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: spacing.sm,
	},
	title: {
		fontSize: 20,
		fontWeight: "bold",
		color: colors.text,
	},
	description: {
		fontSize: 14,
		color: colors.textMuted,
		marginBottom: spacing.md,
	},
	form: {
		gap: spacing.md,
	},
	inputContainer: {
		gap: spacing.xs,
	},
	label: {
		fontSize: 14,
		fontWeight: "500",
		color: colors.text,
	},
	input: {
		backgroundColor: colors.background,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		borderColor: colors.border,
		padding: spacing.md,
		color: colors.text,
		fontSize: 16,
	},
	textArea: {
		minHeight: 80,
		paddingTop: spacing.md,
	},
	buttons: {
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	button: {
		flex: 1,
	},
	buttonText: {
		color: colors.text,
		fontSize: 16,
		fontWeight: "600",
	},
	buttonOutlineText: {
		color: colors.text,
		fontSize: 16,
		fontWeight: "600",
	},
});
