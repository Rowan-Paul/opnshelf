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
	View,
} from "react-native";
import { usePostHog } from "posthog-react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { Button } from "@/components/ui/Button";
import { M3TextField } from "@/components/ui/m3";

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
	const { colors } = useTheme();
	const posthog = usePostHog();

	const createListMutation = useMutation({
		mutationKey: ["lists", "create"],
		...listsControllerCreateListMutation(),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			posthog.capture("list_created", {
				list_name: variables.body.name,
				has_description: !!variables.body.description,
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
				<Pressable style={[styles.content, { backgroundColor: colors.surfaceContainer }]} onPress={(e) => e.stopPropagation()}>
					<View style={styles.header}>
						<Text style={[styles.title, { color: colors.onSurface }]}>Create New List</Text>
						<Pressable onPress={handleClose} hitSlop={8}>
							<Ionicons name="close" size={24} color={colors.onSurface} />
						</Pressable>
					</View>
					<Text style={[styles.description, { color: colors.onSurfaceVariant }]}>
						Create a custom list to organize your movies.
					</Text>

					<View style={styles.form}>
						<View style={styles.inputContainer}>
							<M3TextField
								label="Name"
								placeholder="My Awesome List"
								placeholderTextColor={colors.onSurfaceVariant}
								value={name}
								onChangeText={setName}
								maxLength={100}
								variant="outlined"
							/>
						</View>

						<View style={styles.inputContainer}>
							<M3TextField
								label="Description (optional)"
								style={styles.textArea}
								placeholder="What's this list about?"
								placeholderTextColor={colors.onSurfaceVariant}
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
								variant="outlined"
								onPress={handleClose}
								style={styles.button}
							>
								<Text style={[styles.buttonOutlineText, { color: colors.onSurface }]}>Cancel</Text>
							</Button>
							<Button
								onPress={handleSubmit}
								disabled={!name.trim() || createListMutation.isPending}
								style={styles.button}
							>
								{createListMutation.isPending ? (
									<ActivityIndicator size="small" color={colors.onPrimary} />
								) : (
									<Text style={[styles.buttonText, { color: colors.onPrimary }]}>Create</Text>
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
	},
	description: {
		fontSize: 14,
		marginBottom: spacing.md,
	},
	form: {
		gap: spacing.md,
	},
	inputContainer: {
		gap: spacing.sm,
	},
	textArea: {
		minHeight: 90,
		paddingTop: 20,
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
		fontSize: 16,
		fontWeight: "600",
	},
	buttonOutlineText: {
		fontSize: 16,
		fontWeight: "600",
	},
});
