import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { DatePickerModal, TimePickerModal } from "react-native-paper-dates";
import { Button } from "@/components/ui/Button";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

type WatchDatePickerModalProps = {
	visible: boolean;
	onDismiss: () => void;
	onConfirm: (date: Date) => void;
	isLoading?: boolean;
	is24Hour?: boolean;
};

export function WatchDatePickerModal({
	visible,
	onDismiss,
	onConfirm,
	isLoading = false,
	is24Hour = false,
}: WatchDatePickerModalProps) {
	const { colors: themeColors } = useTheme();
	const [customDate, setCustomDate] = useState(new Date());
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [showTimePicker, setShowTimePicker] = useState(false);

	const handleConfirm = () => {
		onConfirm(customDate);
		onDismiss();
	};

	const handleDateConfirm = (params: { date?: Date }) => {
		setShowDatePicker(false);
		if (params.date) {
			const newDate = new Date(customDate);
			newDate.setFullYear(params.date.getFullYear());
			newDate.setMonth(params.date.getMonth());
			newDate.setDate(params.date.getDate());
			setCustomDate(newDate);
			setShowTimePicker(true);
		}
	};

	const handleTimeConfirm = (params: { hours: number; minutes: number }) => {
		const newDate = new Date(customDate);
		newDate.setHours(params.hours);
		newDate.setMinutes(params.minutes);
		setCustomDate(newDate);
		setShowTimePicker(false);
	};

	return (
		<>
			<Modal
				visible={visible}
				animationType="fade"
				transparent={true}
				onRequestClose={onDismiss}
			>
				<View style={styles.modalOverlay}>
					<View
						style={[
							styles.modalContent,
							{ backgroundColor: themeColors.surfaceContainerHigh },
						]}
					>
						<View style={styles.modalHeader}>
							<Text
								style={[styles.modalTitle, { color: themeColors.onSurface }]}
							>
								Select Watch Date
							</Text>
							<Pressable onPress={onDismiss}>
								<Ionicons
									name="close"
									size={24}
									color={themeColors.onSurface}
								/>
							</Pressable>
						</View>
						<Text
							style={[
								styles.modalDescription,
								{ color: themeColors.onSurfaceVariant },
							]}
						>
							When did you watch this?
						</Text>

						<View style={styles.dateTimeContainer}>
							<TouchableOpacity
								onPress={() => setShowDatePicker(true)}
								style={styles.dateTimeButton}
								activeOpacity={0.7}
							>
								<Ionicons
									name="calendar-outline"
									size={20}
									color={themeColors.onSurfaceVariant}
								/>
								<Text
									style={[
										styles.dateTimeText,
										{ color: themeColors.onSurface },
									]}
								>
									{customDate.toLocaleDateString("en-US", {
										year: "numeric",
										month: "short",
										day: "numeric",
									})}
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								onPress={() => setShowTimePicker(true)}
								style={styles.dateTimeButton}
								activeOpacity={0.7}
							>
								<Ionicons
									name="time-outline"
									size={20}
									color={themeColors.onSurfaceVariant}
								/>
								<Text
									style={[
										styles.dateTimeText,
										{ color: themeColors.onSurface },
									]}
								>
									{customDate.toLocaleTimeString("en-US", {
										hour: "2-digit",
										minute: "2-digit",
										hour12: !is24Hour,
									})}
								</Text>
							</TouchableOpacity>
						</View>

						<DatePickerModal
							visible={showDatePicker}
							mode="single"
							date={customDate}
							locale="en"
							onDismiss={() => setShowDatePicker(false)}
							onConfirm={handleDateConfirm}
						/>

						<TimePickerModal
							visible={showTimePicker}
							hours={customDate.getHours()}
							minutes={customDate.getMinutes()}
							locale="en"
							use24HourClock={is24Hour}
							onDismiss={() => setShowTimePicker(false)}
							onConfirm={handleTimeConfirm}
						/>

						<View style={styles.modalActionsSplit}>
							<Button variant="outlined" onPress={onDismiss}>
								<Text
									style={[
										styles.modalCancelText,
										{ color: themeColors.onSurfaceVariant },
									]}
								>
									Cancel
								</Text>
							</Button>
							<Button
								onPress={handleConfirm}
								isLoading={isLoading}
								style={{ backgroundColor: themeColors.primary }}
							>
								<Text
									style={[
										styles.modalConfirmText,
										{ color: themeColors.onPrimary },
									]}
								>
									Add Watch
								</Text>
							</Button>
						</View>
					</View>
				</View>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		padding: spacing.lg,
	},
	modalContent: {
		borderRadius: borderRadius.lg,
		padding: spacing.md,
		gap: spacing.md,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: "700",
	},
	modalDescription: {
		fontSize: 14,
	},
	dateTimeContainer: {
		gap: spacing.sm,
	},
	dateTimeButton: {
		padding: spacing.md,
		borderRadius: borderRadius.md,
		backgroundColor: "rgba(255, 255, 255, 0.05)",
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	dateTimeText: {
		fontSize: 15,
		fontWeight: "500",
	},
	modalActionsSplit: {
		flexDirection: "row",
		gap: spacing.sm,
		justifyContent: "space-between",
	},
	modalCancelText: {
		fontSize: 14,
		fontWeight: "600",
	},
	modalConfirmText: {
		fontSize: 14,
		fontWeight: "600",
	},
});
