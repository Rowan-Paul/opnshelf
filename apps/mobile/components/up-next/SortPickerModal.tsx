import {
	ArrowDownAZ,
	ArrowUpDown,
	Check,
	Clock,
	TrendingUp,
} from "lucide-react-native";
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

type SortBy = "lastWatched" | "title" | "progress";
type SortOrder = "asc" | "desc";
type SortValue = `${SortBy}-${SortOrder}`;

const SORT_OPTIONS: Array<{
	value: SortValue;
	label: string;
	Icon: typeof Clock;
}> = [
	{ value: "lastWatched-desc", label: "Recently watched", Icon: Clock },
	{ value: "lastWatched-asc", label: "Oldest watched", Icon: Clock },
	{ value: "title-asc", label: "Title A-Z", Icon: ArrowDownAZ },
	{ value: "title-desc", label: "Title Z-A", Icon: ArrowDownAZ },
	{ value: "progress-desc", label: "Most progress", Icon: TrendingUp },
	{ value: "progress-asc", label: "Least progress", Icon: TrendingUp },
];

interface SortPickerModalProps {
	visible: boolean;
	onClose: () => void;
	value: SortValue;
	onSelect: (value: SortValue) => void;
}

export type { SortBy, SortOrder, SortValue };

export function SortPickerModal({
	visible,
	onClose,
	value,
	onSelect,
}: SortPickerModalProps) {
	const { colors } = useTheme();

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={onClose}
		>
			<Pressable style={styles.overlay} onPress={onClose}>
				<Pressable
					style={[
						styles.sheet,
						{ backgroundColor: colors.surfaceContainer },
					]}
					onPress={(e) => e.stopPropagation()}
				>
					<View style={styles.handle}>
						<View
							style={[
								styles.handleBar,
								{ backgroundColor: colors.onSurfaceVariant },
							]}
						/>
					</View>

					<View style={styles.header}>
						<ArrowUpDown size={20} color={colors.onSurface} />
						<Text style={[styles.title, { color: colors.onSurface }]}>
							Sort by
						</Text>
					</View>

					<View style={styles.options}>
						{SORT_OPTIONS.map((opt) => {
							const isSelected = opt.value === value;
							return (
								<Pressable
									key={opt.value}
									onPress={() => {
										onSelect(opt.value);
										onClose();
									}}
									style={[
										styles.option,
										isSelected && {
											backgroundColor: `${colors.primaryContainer}`,
										},
									]}
								>
									<opt.Icon
										size={18}
										color={
											isSelected
												? colors.onPrimaryContainer
												: colors.onSurfaceVariant
										}
									/>
									<Text
										style={[
											styles.optionLabel,
											{
												color: isSelected
													? colors.onPrimaryContainer
													: colors.onSurface,
												fontWeight: isSelected ? "700" : "500",
											},
										]}
									>
										{opt.label}
									</Text>
									{isSelected && (
										<Check
											size={18}
											color={colors.onPrimaryContainer}
											style={styles.checkIcon}
										/>
									)}
								</Pressable>
							);
						})}
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "flex-end",
	},
	sheet: {
		borderTopLeftRadius: borderRadius.xxl,
		borderTopRightRadius: borderRadius.xxl,
		paddingBottom: spacing.xl,
	},
	handle: {
		alignItems: "center",
		paddingVertical: spacing.sm,
	},
	handleBar: {
		width: 36,
		height: 4,
		borderRadius: borderRadius.full,
		opacity: 0.4,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.sm,
		paddingBottom: spacing.md,
	},
	title: {
		fontSize: 18,
		fontWeight: "700",
	},
	options: {
		paddingHorizontal: spacing.md,
	},
	option: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		paddingVertical: spacing.md,
		paddingHorizontal: spacing.md,
		borderRadius: borderRadius.lg,
	},
	optionLabel: {
		fontSize: 15,
		flex: 1,
	},
	checkIcon: {
		marginLeft: "auto",
	},
});
