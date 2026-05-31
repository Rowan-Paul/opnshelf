import { FlashList } from "@shopify/flash-list";
import { Check, ChevronDown, Search, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { COUNTRY_NAMES, SORTED_COUNTRIES } from "@/lib/countries";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Country selector: a tappable field that opens a modal with a search box and a
 * scrollable list of countries. Mobile has no `Select` primitive, so this is a
 * lightweight stand-in built from `Modal` + `FlashList`. Mirrors the web
 * `CountrySelector`, backed by the same `countries.ts` data.
 */
export function CountryPicker({
	value,
	onChange,
	disabled,
}: {
	value: string;
	onChange: (code: string) => void;
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const insets = useSafeAreaInsets();
	const listStyle = useTwStyle("px-4 pb-8");

	const selectedName = COUNTRY_NAMES[value] ?? value;

	const results = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return SORTED_COUNTRIES;
		return SORTED_COUNTRIES.filter(
			([code, name]) =>
				name.toLowerCase().includes(q) || code.toLowerCase().includes(q),
		);
	}, [query]);

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
				<Text className="text-[16px] text-foreground">{selectedName}</Text>
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
							Streaming country
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
							placeholder="Search countries…"
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="search"
						/>
					</View>

					<FlashList
						data={results}
						keyExtractor={([code]) => code}
						contentContainerStyle={listStyle}
						keyboardShouldPersistTaps="handled"
						renderItem={({ item: [code, name] }) => {
							const isSelected = code === value;
							return (
								<Pressable
									onPress={() => {
										onChange(code);
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
										{name}
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
