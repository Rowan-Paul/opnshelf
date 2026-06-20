import { FlashList } from "@shopify/flash-list";
import { Check, ChevronDown, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * IANA timezone list. Mirrors the web `TimezoneSelector`: prefer the runtime
 * `Intl.supportedValuesOf("timeZone")` and fall back to a curated shortlist when
 * the engine doesn't support it (older Hermes builds).
 */
function getTimeZones(): string[] {
	try {
		// Available on Hermes with Intl enabled; falls through to the catch when not.
		const supported = (
			Intl as unknown as {
				supportedValuesOf?: (key: string) => string[];
			}
		).supportedValuesOf;
		if (supported) {
			return supported("timeZone");
		}
	} catch {
		// fall through
	}
	return [
		"UTC",
		"America/New_York",
		"America/Chicago",
		"America/Denver",
		"America/Los_Angeles",
		"America/Anchorage",
		"America/Honolulu",
		"Europe/London",
		"Europe/Paris",
		"Europe/Berlin",
		"Europe/Amsterdam",
		"Europe/Moscow",
		"Asia/Tokyo",
		"Asia/Shanghai",
		"Asia/Dubai",
		"Asia/Kolkata",
		"Asia/Singapore",
		"Australia/Sydney",
		"Pacific/Auckland",
		"Pacific/Honolulu",
	];
}

/**
 * Timezone selector: a tappable field that opens a modal with a search box and a
 * scrollable list of IANA timezones. Mobile has no `Select` primitive, so this
 * mirrors `CountryPicker` (Modal + FlashList) and the web `TimezoneSelector`
 * data source.
 */
export function TimezonePicker({
	value,
	onChange,
	disabled,
}: {
	value?: string;
	onChange: (timezone: string) => void;
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const insets = useSafeAreaInsets();
	const listStyle = useTwStyle("px-4 pb-8");

	const zones = useMemo(() => getTimeZones(), []);

	const results = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return zones;
		return zones.filter((zone) => zone.toLowerCase().includes(q));
	}, [query, zones]);

	const close = () => {
		setOpen(false);
		setQuery("");
	};

	return (
		<>
			<Pressable
				disabled={disabled}
				onPress={() => setOpen(true)}
				className="flex-row items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
				style={{ opacity: disabled ? 0.6 : 1 }}
			>
				<Text className="text-[16px] text-foreground">
					{value ?? "Select timezone"}
				</Text>
				<ChevronDown color="#94a3b8" size={18} />
			</Pressable>

			<Modal
				visible={open}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={close}
			>
				<View
					className="flex-1 bg-background"
					style={{ paddingTop: insets.top }}
				>
					<View className="flex-row items-center justify-between px-4 py-3">
						<Text className="font-display font-semibold text-foreground text-lg">
							Timezone
						</Text>
						<Pressable hitSlop={8} onPress={close}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					<View className="px-4 pb-3">
						<TextField
							leading={<Search color="#94a3b8" size={18} />}
							trailing={
								query.length > 0 ? (
									<Pressable hitSlop={8} onPress={() => setQuery("")}>
										<X color="#94a3b8" size={18} />
									</Pressable>
								) : null
							}
							value={query}
							onChangeText={setQuery}
							placeholder="Search timezones…"
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="search"
						/>
					</View>

					<FlashList
						data={results}
						keyExtractor={(zone) => zone}
						contentContainerStyle={listStyle}
						keyboardShouldPersistTaps="handled"
						renderItem={({ item: zone }) => {
							const isSelected = zone === value;
							return (
								<Pressable
									onPress={() => {
										onChange(zone);
										close();
									}}
									className="flex-row items-center justify-between border-border/60 border-b py-3"
								>
									<Text
										className={
											isSelected
												? "font-medium text-foreground"
												: "text-foreground"
										}
									>
										{zone}
									</Text>
									{isSelected ? <Check color="#f3bc00" size={18} /> : null}
								</Pressable>
							);
						}}
					/>
				</View>
			</Modal>
		</>
	);
}
