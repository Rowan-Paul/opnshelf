import {
	getAccountDeletionProgress,
	getAccountDeletionStepLabel,
	type AccountDeletionJobDto,
} from "@opnshelf/api";
import { Loader2, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import type { ExtendedThemeColors } from "@/constants/extended-theme";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface DeleteAccountModalProps {
	visible: boolean;
	isDeleting: boolean;
	deletionJob: AccountDeletionJobDto | null | undefined;
	onClose: () => void;
	onConfirm: (deletePDSData: boolean) => void;
	onRetry: () => void;
}

export function DeleteAccountModal({
	visible,
	isDeleting,
	deletionJob,
	onClose,
	onConfirm,
	onRetry,
}: DeleteAccountModalProps) {
	const { colors } = useTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const [deletePDSData, setDeletePDSData] = useState(false);

	const isInProgress =
		deletionJob?.status === "queued" || deletionJob?.status === "running";
	const isFailed = deletionJob?.status === "failed";

	useEffect(() => {
		if (visible && !isInProgress && !isFailed) {
			setDeletePDSData(false);
		}
	}, [visible, isInProgress, isFailed]);

	const progress = deletionJob
		? getAccountDeletionProgress(deletionJob)
		: null;
	const stepLabel = deletionJob
		? getAccountDeletionStepLabel(deletionJob.currentStep)
		: "Preparing…";

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={isInProgress ? undefined : onClose}
		>
			<View style={styles.modalOverlay}>
				<View style={styles.deleteModalContent}>
					{isInProgress || isFailed ? (
						<>
							<View style={styles.deleteModalIcon}>
								{isFailed ? (
									<Trash2 size={32} color={colors.error} />
								) : (
									<Loader2 size={32} color={colors.primary} />
								)}
							</View>
							<Text style={styles.deleteModalTitle}>
								{isFailed ? "Deletion Failed" : "Deleting Account…"}
							</Text>
							<Text style={styles.deleteModalDescription}>
								{isFailed
									? "Something went wrong while deleting your account."
									: "Please keep the app open. Your data is being removed."}
							</Text>

							{!isFailed && (
								<View style={styles.progressContainer}>
									<View style={styles.progressLabelRow}>
										<Text style={styles.progressLabel}>{stepLabel}</Text>
										{progress !== null && (
											<Text style={styles.progressPercent}>
												{progress}%
											</Text>
										)}
									</View>
									<View style={styles.progressBarBg}>
										<View
											style={[
												styles.progressBarFill,
												{
													width: `${progress ?? 0}%`,
													backgroundColor: colors.primary,
												},
											]}
										/>
									</View>
									{deletionJob && deletionJob.totalRecords > 0 && (
										<Text style={styles.progressDetail}>
											{deletionJob.deletedRecords} of{" "}
											{deletionJob.totalRecords} records deleted
										</Text>
									)}
								</View>
							)}

							{isFailed && (
								<>
									<View style={styles.deleteWarningBox}>
										<Text style={styles.deleteWarningText}>
											{deletionJob?.lastError ??
												"Account deletion failed. Please try again or contact support."}
										</Text>
									</View>
									<View style={styles.deleteModalButtons}>
										<Button
											variant="outlined"
											onPress={onClose}
											style={styles.deleteModalButton}
										>
											<Text style={styles.deleteModalButtonText}>Close</Text>
										</Button>
										<Button
											variant="filled"
											onPress={onRetry}
											style={styles.deleteModalButton}
										>
											Retry
										</Button>
									</View>
								</>
							)}
						</>
					) : (
						<>
							<View style={styles.deleteModalIcon}>
								<Trash2 size={32} color={colors.error} />
							</View>
							<Text style={styles.deleteModalTitle}>Delete Account</Text>
							<Text style={styles.deleteModalDescription}>
								Are you sure you want to delete your account? This action
								cannot be undone.
							</Text>

							<View style={styles.deleteDataBox}>
								<Text style={styles.deleteDataBoxTitle}>
									What happens to your data:
								</Text>
								<View style={styles.deleteDataItem}>
									<Text style={styles.deleteDataCheck}>✓</Text>
									<Text style={styles.deleteDataText}>
										Your OpnShelf account and settings will be deleted
									</Text>
								</View>
								<View style={styles.deleteDataItem}>
									<Text style={styles.deleteDataCheck}>✓</Text>
									<Text style={styles.deleteDataText}>
										Your local session will be cleared
									</Text>
								</View>
							</View>

							<View style={styles.pdsSwitchRow}>
								<Text style={styles.pdsSwitchLabel}>
									Also delete my OpnShelf data from my PDS
								</Text>
								<Switch
									value={deletePDSData}
									onValueChange={setDeletePDSData}
									disabled={isDeleting}
								/>
							</View>

							{deletePDSData ? (
								<View style={styles.deleteWarningBox}>
									<Text style={styles.deleteWarningText}>
										Your OpnShelf data, including watch history, follows, lists,
										and list items, will be permanently deleted from your
										personal data server. This cannot be recovered.
									</Text>
								</View>
							) : (
								<View style={styles.deleteInfoBox}>
									<Text style={styles.deleteInfoText}>
										Your OpnShelf data will remain on your PDS. You can use
										another app or re-authorize OpnShelf later to access it.
									</Text>
								</View>
							)}

							<View style={styles.deleteModalButtons}>
								<Button
									variant="outlined"
									onPress={onClose}
									disabled={isDeleting}
									style={styles.deleteModalButton}
								>
									<Text style={styles.deleteModalButtonText}>Cancel</Text>
								</Button>
								<Button
									variant="filled"
									onPress={() => onConfirm(deletePDSData)}
									isLoading={isDeleting}
									disabled={isDeleting}
									style={styles.deleteModalButton}
								>
									Delete Account
								</Button>
							</View>
						</>
					)}
				</View>
			</View>
		</Modal>
	);
}

const createStyles = (colors: ExtendedThemeColors) =>
	StyleSheet.create({
		modalOverlay: {
			flex: 1,
			backgroundColor: "rgba(0, 0, 0, 0.7)",
			justifyContent: "center",
			alignItems: "center",
			padding: spacing.lg,
		},
		deleteModalContent: {
			backgroundColor: colors.card,
			borderRadius: borderRadius.xl,
			padding: spacing.xl,
			width: "100%",
			maxWidth: 340,
			alignItems: "center",
		},
		deleteModalIcon: {
			width: 64,
			height: 64,
			borderRadius: 32,
			backgroundColor: "rgba(239, 68, 68, 0.1)",
			justifyContent: "center",
			alignItems: "center",
			marginBottom: spacing.md,
		},
		deleteModalTitle: {
			fontSize: 20,
			fontWeight: "600",
			color: colors.text,
			marginBottom: spacing.sm,
			textAlign: "center",
		},
		deleteModalDescription: {
			fontSize: 14,
			color: colors.textMuted,
			textAlign: "center",
			marginBottom: spacing.md,
			lineHeight: 20,
		},
		deleteDataBox: {
			backgroundColor: colors.background,
			borderRadius: borderRadius.lg,
			padding: spacing.md,
			width: "100%",
			marginBottom: spacing.md,
			gap: spacing.xs,
		},
		deleteDataBoxTitle: {
			fontSize: 14,
			fontWeight: "500",
			color: colors.textMuted,
			marginBottom: spacing.xs,
		},
		deleteDataItem: {
			flexDirection: "row",
			alignItems: "flex-start",
			gap: spacing.sm,
			marginBottom: spacing.xs,
		},
		deleteDataCheck: {
			color: colors.primary,
			fontSize: 14,
			fontWeight: "600",
		},
		deleteDataText: {
			fontSize: 13,
			color: colors.text,
			flex: 1,
		},
		pdsSwitchRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: spacing.md,
			width: "100%",
			padding: spacing.md,
			borderRadius: borderRadius.lg,
			backgroundColor: colors.background,
			marginBottom: spacing.md,
		},
		pdsSwitchLabel: {
			fontSize: 14,
			color: colors.text,
			flex: 1,
		},
		deleteWarningBox: {
			width: "100%",
			padding: spacing.sm,
			borderRadius: borderRadius.md,
			backgroundColor: `${colors.error}18`,
			borderWidth: 1,
			borderColor: `${colors.error}33`,
			marginBottom: spacing.md,
		},
		deleteWarningText: {
			fontSize: 13,
			lineHeight: 18,
			color: colors.error,
		},
		deleteInfoBox: {
			width: "100%",
			padding: spacing.sm,
			borderRadius: borderRadius.md,
			backgroundColor: colors.background,
			marginBottom: spacing.md,
		},
		deleteInfoText: {
			fontSize: 13,
			lineHeight: 18,
			color: colors.textMuted,
		},
		deleteModalButtons: {
			flexDirection: "row",
			gap: spacing.sm,
			width: "100%",
		},
		deleteModalButton: {
			flex: 1,
		},
		deleteModalButtonText: {
			color: colors.text,
			fontSize: 14,
			fontWeight: "500",
		},
		progressContainer: {
			width: "100%",
			marginBottom: spacing.md,
			gap: spacing.xs,
		},
		progressLabelRow: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
		},
		progressLabel: {
			fontSize: 13,
			color: colors.textMuted,
		},
		progressPercent: {
			fontSize: 13,
			fontWeight: "600",
			fontVariant: ["tabular-nums"],
			color: colors.primary,
		},
		progressBarBg: {
			height: 6,
			borderRadius: 3,
			backgroundColor: `${colors.primary}20`,
			overflow: "hidden",
		},
		progressBarFill: {
			height: "100%",
			borderRadius: 3,
		},
		progressDetail: {
			fontSize: 12,
			color: colors.textMuted,
		},
	});
