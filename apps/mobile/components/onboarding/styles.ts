import { StyleSheet } from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";

export const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollContent: {
		padding: spacing.md,
		gap: spacing.md,
	},
	progressCard: {
		marginBottom: spacing.xs,
	},
	kicker: {
		fontSize: 12,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	title: {
		fontSize: 24,
		fontWeight: "700",
		marginTop: 2,
	},
	subtitle: {
		fontSize: 13,
		marginTop: 2,
	},
	progressTrack: {
		height: 8,
		borderRadius: borderRadius.full,
		overflow: "hidden",
	},
	progressFill: {
		height: "100%",
		borderRadius: borderRadius.full,
	},
	stepsList: {
		marginTop: spacing.sm,
		gap: spacing.xs,
		flexDirection: "row",
		flexWrap: "wrap",
	},
	stepRow: {
		flexDirection: "row",
		gap: spacing.xs,
		paddingHorizontal: spacing.sm,
		paddingVertical: 12,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		width: "49%",
		alignItems: "center",
	},
	stepBadge: {
		width: 20,
		height: 20,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	stepTextWrap: {
		flex: 1,
	},
	stepTitle: {
		fontSize: 13,
		fontWeight: "600",
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: "700",
	},
	sectionBody: {
		fontSize: 13,
		lineHeight: 18,
		marginTop: 2,
	},
	bulletList: {
		gap: 2,
	},
	bulletItem: {
		fontSize: 13,
		lineHeight: 18,
	},
	actionsRow: {
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.sm,
		flexWrap: "wrap",
	},
	formStack: {
		gap: spacing.sm,
	},
	profileFormStack: {
		gap: spacing.md,
		marginTop: 0,
	},
	importFormStack: {
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	selectionRow: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	selectionLabel: {
		fontSize: 14,
		fontWeight: "600",
	},
	selectionValue: {
		fontSize: 12,
		marginTop: 2,
	},
	selectionAction: {
		fontSize: 13,
		fontWeight: "600",
	},
	toggleWrap: {
		gap: spacing.sm,
		marginVertical: 0,
	},
	timeFormatRow: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	timeFormatPill: {
		paddingHorizontal: spacing.md,
		paddingVertical: 6,
		borderRadius: borderRadius.full,
	},
	importStatusBox: {
		borderRadius: borderRadius.md,
		borderWidth: 1,
		padding: spacing.sm,
		gap: spacing.xs,
	},
	importStatusText: {
		fontSize: 13,
		fontWeight: "600",
	},
	importStatusMeta: {
		fontSize: 11,
	},
	previewCard: {
		borderRadius: borderRadius.md,
		borderWidth: 1,
		padding: spacing.md,
		gap: spacing.md,
	},
	previewHeaderRow: {
		flexDirection: "row",
		gap: spacing.sm,
		justifyContent: "space-between",
		alignItems: "flex-start",
	},
	identityAvatarRow: {
		flexDirection: "row",
		gap: spacing.md,
		alignItems: "center",
	},
	identityAvatar: {
		width: 72,
		height: 72,
		borderRadius: 36,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "center",
	},
	identityAvatarImage: {
		width: "100%",
		height: "100%",
	},
	identityAvatarFallback: {
		fontSize: 28,
		fontWeight: "700",
	},
	previewHeaderText: {
		flex: 1,
		gap: 2,
	},
	previewKicker: {
		fontSize: 11,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 0.8,
	},
	previewTitle: {
		fontSize: 18,
		fontWeight: "700",
	},
	previewSubtitle: {
		fontSize: 12,
		lineHeight: 18,
	},
	previewCountWrap: {
		alignItems: "flex-end",
		gap: 2,
	},
	previewCountLabel: {
		fontSize: 11,
		fontWeight: "600",
		textTransform: "uppercase",
	},
	previewCountValue: {
		fontSize: 26,
		fontWeight: "700",
	},
	previewListWrap: {
		gap: spacing.sm,
	},
	previewSectionLabel: {
		fontSize: 11,
		fontWeight: "700",
		textTransform: "uppercase",
	},
	previewItem: {
		borderRadius: borderRadius.md,
		borderWidth: 1,
		padding: spacing.sm,
		flexDirection: "row",
		gap: spacing.sm,
		justifyContent: "space-between",
	},
	previewItemText: {
		flex: 1,
		gap: 2,
	},
	previewItemTitle: {
		fontSize: 14,
		fontWeight: "600",
	},
	previewItemSubtitle: {
		fontSize: 12,
		lineHeight: 18,
	},
	previewItemDate: {
		fontSize: 11,
		textAlign: "right",
		maxWidth: 110,
	},
	tabRow: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	tabButton: {
		paddingHorizontal: spacing.md,
		paddingVertical: 6,
		borderRadius: borderRadius.full,
	},
	csvButton: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	csvButtonText: {
		fontSize: 13,
		fontWeight: "600",
	},
	csvFileName: {
		fontSize: 12,
	},
	csvHelp: {
		fontSize: 12,
		lineHeight: 18,
	},
	metricsRow: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	metricCard: {
		flex: 1,
		borderRadius: borderRadius.md,
		padding: spacing.sm,
		borderWidth: 1,
	},
	metricLabel: {
		fontSize: 11,
		fontWeight: "600",
		textTransform: "uppercase",
	},
	metricValue: {
		fontSize: 22,
		fontWeight: "700",
		marginTop: 2,
	},
	errorBox: {
		marginTop: spacing.md,
		padding: spacing.md,
		borderWidth: 1,
		borderRadius: borderRadius.md,
	},
	errorTitle: {
		fontSize: 14,
		fontWeight: "700",
		marginBottom: spacing.sm,
	},
	errorScroll: {
		maxHeight: 140,
	},
	errorItem: {
		fontSize: 12,
		lineHeight: 18,
		marginBottom: spacing.xs,
	},
	modalContainer: {
		flex: 1,
	},
	modalHeader: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
		borderBottomWidth: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "700",
	},
	modalSearchWrap: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
	},
	modalList: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
	},
	zoneItem: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.md,
		borderWidth: 1,
		marginBottom: spacing.xs,
	},
	zoneLabel: {
		fontSize: 15,
		fontWeight: "600",
	},
	zoneRegion: {
		fontSize: 12,
		marginTop: 2,
	},
});
