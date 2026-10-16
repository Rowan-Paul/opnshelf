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
	initialWatchedAt?: string | null;
	timeZone?: string;
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
	initialWatchedAt,
	timeZone,
}: WatchDatePickerModalProps) {
	// The picker paints its own text: hardcoding a variant renders dark-mode
	// text on the light card, which leaves the whole calendar unreadable.
	const themeVariant = useColorScheme() === "dark" ? "dark" : "light";
	const isEditing = initialWatchedAt !== undefined;
	const [noDate, setNoDate] = useState(initialWatchedAt === null);
	const [date, setDate] = useState(() => new Date());

	// On Android the picker is a one-shot dialog, so we drive it in two phases.
	const [androidMode, setAndroidMode] = useState<"date" | "time" | null>(null);

	// Re-seed "now" on every open: the modal stays mounted with its parent
	// screen, so without this a second open still offers the first pick.
	useEffect(() => {
		if (visible) {
			setDate(initialWatchedAt ? new Date(initialWatchedAt) : new Date());
			setNoDate(initialWatchedAt === null);
			setAndroidMode(null);
		}
	}, [visible, initialWatchedAt]);

	const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
		if (Platform.OS === "android") {
			if (event.type === "dismissed") {
				setAndroidMode(null);
				return;
			}
			if (selected) {
				// Native returns an instant in timeZoneName; device-local setters
				// would shift the selected day/hour when those zones differ.
				setDate(selected);
				setAndroidMode(androidMode === "date" ? "time" : null);
			}
			return;
		}
		// iOS: the inline picker reports the full datetime directly.
		if (selected) setDate(selected);
	};

	const handleConfirm = () => {
		if (isLoading || (!noDate && date.getTime() > Date.now())) return;
		onConfirm(noDate ? null : date.toISOString());
	};

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
			onRequestClose={isLoading ? undefined : onDismiss}
		>
			<Pressable
				accessible={false}
				onPress={onDismiss}
				disabled={isLoading}
				className="flex-1 items-center justify-center bg-black/70 px-6"
			>
				<Pressable
					accessible={false}
					onPress={(e) => e.stopPropagation()}
					className="w-full gap-4 rounded-2xl border border-border bg-card p-5"
				>
					<View className="flex-row items-center justify-between">
						<Text className="font-bold font-display text-foreground text-lg">
							{isEditing ? "Edit watch date" : "Select watch date"}
						</Text>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Close date editor"
							hitSlop={8}
							onPress={onDismiss}
							disabled={isLoading}
						>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>
					<Text className="text-muted-foreground text-sm">
						When did you watch this?
					</Text>

					{timeZone && (
						<Text className="text-muted-foreground text-xs">{timeZone}</Text>
					)}

					{noDate ? (
						<Text className="py-4 text-foreground">No date selected</Text>
					) : Platform.OS === "ios" ? (
						<DateTimePicker
							value={date}
							timeZoneName={timeZone}
							disabled={isLoading}
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
								disabled={isLoading}
								className="flex-row items-center gap-3 rounded-lg bg-background-subtle p-3"
							>
								<Calendar color="#94a3b8" size={20} />
								<Text className="font-medium text-foreground">
									{date.toLocaleDateString(undefined, {
										timeZone,
										day: "numeric",
										month: "short",
										year: "numeric",
									})}
								</Text>
							</Pressable>
							<Pressable
								onPress={() => setAndroidMode("time")}
								disabled={isLoading}
								className="flex-row items-center gap-3 rounded-lg bg-background-subtle p-3"
							>
								<Clock color="#94a3b8" size={20} />
								<Text className="font-medium text-foreground">
									{date.toLocaleTimeString(undefined, {
										timeZone,
										hour: "2-digit",
										minute: "2-digit",
									})}
								</Text>
							</Pressable>
							{androidMode ? (
								<DateTimePicker
									value={date}
									timeZoneName={timeZone}
									disabled={isLoading}
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
							accessibilityRole="button"
							onPress={onDismiss}
							disabled={isLoading}
							className="flex-1 items-center rounded-lg border border-border py-3"
						>
							<Text className="font-semibold text-foreground">Cancel</Text>
						</Pressable>
						<Button
							label={isEditing ? "Save" : "Add watch"}
							disabled={!noDate && date.getTime() > Date.now()}
							loadingLabel="Saving…"
							loading={isLoading}
							className="flex-1"
							onPress={handleConfirm}
						/>
					</View>

					{/* Edits stay a draft until Save; new Watches retain one-tap No date. */}
					<Pressable
						onPress={() => (isEditing ? setNoDate(!noDate) : onConfirm(null))}
						accessibilityState={{ selected: noDate }}
						disabled={isLoading}
						hitSlop={8}
						accessibilityRole="button"
						className="items-center py-1"
					>
						<Text className="text-muted-foreground text-sm underline">
							{noDate ? "Choose a date" : "No date"}
						</Text>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	);
}
