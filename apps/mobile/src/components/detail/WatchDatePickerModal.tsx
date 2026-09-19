import DateTimePicker, {
	type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Calendar, Clock, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, useColorScheme, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

interface WatchDatePickerModalProps {
	visible: boolean;
	onDismiss: () => void;
	/**
	 * Confirm with the chosen datetime as an ISO 8601 string, or `null` for an
	 * undated Watch — "I watched this, I'm not saying when".
	 */
	onConfirm: (isoDate: string | null) => void;
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
	// The picker paints its own text: hardcoding a variant renders dark-mode
	// text on the light card, which leaves the whole calendar unreadable.
	const themeVariant = useColorScheme() === "dark" ? "dark" : "light";
	const [date, setDate] = useState(() => new Date());

	// On Android the picker is a one-shot dialog, so we drive it in two phases.
	const [androidMode, setAndroidMode] = useState<"date" | "time" | null>(null);

	// Re-seed "now" on every open: the modal stays mounted with its parent
	// screen, so without this a second open still offers the first pick.
	useEffect(() => {
		if (visible) {
			setDate(new Date());
			setAndroidMode(null);
		}
	}, [visible]);

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
							themeVariant={themeVariant}
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
									themeVariant={themeVariant}
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
						<Button
							label="Add watch"
							loadingLabel="Saving…"
							loading={isLoading}
							className="flex-1"
							onPress={handleConfirm}
						/>
					</View>

					{/* A complete answer in itself, so it submits on one tap. */}
					<Pressable
						onPress={() => onConfirm(null)}
						disabled={isLoading}
						hitSlop={8}
						accessibilityRole="button"
						className="items-center py-1"
					>
						<Text className="text-muted-foreground text-sm underline">
							No date
						</Text>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	);
}
