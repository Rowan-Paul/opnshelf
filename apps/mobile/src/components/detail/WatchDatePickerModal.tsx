import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Calendar, Clock, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

interface WatchDatePickerModalProps {
	visible: boolean;
	onDismiss: () => void;
	/** Confirm with the chosen datetime as an ISO 8601 string. */
	onConfirm: (isoDate: string) => void;
	isLoading?: boolean;
}

/**
 * Lets the user pick a custom watch date + time, returning an ISO string for the
 * `watchedAt` field on the mark-watched endpoints. Uses
 * `@react-native-community/datetimepicker`, which renders an inline spinner on
 * iOS and a system dialog on Android.
 *
 * The DateTimePicker is NOT an RN-core component, so its `className` would be a
 * no-op (Uniwind only rewrites `react-native` imports). It's styled via its own
 * native props / theme variant instead.
 */
export function WatchDatePickerModal({
	visible,
	onDismiss,
	onConfirm,
	isLoading = false,
}: WatchDatePickerModalProps) {
	const [date, setDate] = useState(() => new Date());
	// On Android the picker is a one-shot dialog, so we drive it in two phases.
	const [androidMode, setAndroidMode] = useState<"date" | "time" | null>(null);

	const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
		if (Platform.OS === "android") {
			if (event.type === "dismissed") {
				setAndroidMode(null);
				return;
			}
			if (selected) {
				if (androidMode === "date") {
					const next = new Date(date);
					next.setFullYear(
						selected.getFullYear(),
						selected.getMonth(),
						selected.getDate(),
					);
					setDate(next);
					setAndroidMode("time");
					return;
				}
				const next = new Date(date);
				next.setHours(selected.getHours(), selected.getMinutes());
				setDate(next);
				setAndroidMode(null);
			}
			return;
		}
		// iOS: the inline picker reports the full datetime directly.
		if (selected) setDate(selected);
	};

	const handleConfirm = () => {
		onConfirm(date.toISOString());
	};

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={onDismiss}
		>
			<Pressable
				onPress={onDismiss}
				className="flex-1 items-center justify-center bg-black/70 px-6"
			>
				<Pressable
					onPress={(e) => e.stopPropagation()}
					className="w-full gap-4 rounded-2xl border border-border bg-card p-5"
				>
					<View className="flex-row items-center justify-between">
						<Text className="font-bold font-display text-foreground text-lg">
							Select watch date
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>
					<Text className="text-muted-foreground text-sm">
						When did you watch this?
					</Text>

					{Platform.OS === "ios" ? (
						<DateTimePicker
							value={date}
							mode="datetime"
							display="inline"
							maximumDate={new Date()}
							onChange={handleChange}
							themeVariant="dark"
						/>
					) : (
						<View className="gap-2">
							<Pressable
								onPress={() => setAndroidMode("date")}
								className="flex-row items-center gap-3 rounded-lg bg-background-subtle p-3"
							>
								<Calendar color="#94a3b8" size={20} />
								<Text className="font-medium text-foreground">
									{date.toLocaleDateString(undefined, {
										day: "numeric",
										month: "short",
										year: "numeric",
									})}
								</Text>
							</Pressable>
							<Pressable
								onPress={() => setAndroidMode("time")}
								className="flex-row items-center gap-3 rounded-lg bg-background-subtle p-3"
							>
								<Clock color="#94a3b8" size={20} />
								<Text className="font-medium text-foreground">
									{date.toLocaleTimeString(undefined, {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</Text>
							</Pressable>
							{androidMode ? (
								<DateTimePicker
									value={date}
									mode={androidMode}
									display="default"
									maximumDate={new Date()}
									onChange={handleChange}
								/>
							) : null}
						</View>
					)}

					<View className="flex-row gap-3">
						<Pressable
							onPress={onDismiss}
							className="flex-1 items-center rounded-lg border border-border py-3"
						>
							<Text className="font-semibold text-foreground">Cancel</Text>
						</Pressable>
						<Pressable
							onPress={handleConfirm}
							disabled={isLoading}
							className="flex-1 items-center rounded-lg bg-primary py-3"
							style={{ opacity: isLoading ? 0.7 : 1 }}
						>
							<Text className="font-semibold text-primary-foreground">
								{isLoading ? "Saving…" : "Add watch"}
							</Text>
						</Pressable>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}
