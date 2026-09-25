import { streamingServicesControllerListOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import {
	StreamingServicePicker,
	toggleService,
} from "@/components/ui/streaming-service-picker";
import { Text } from "@/components/ui/text";

export function UpNextServiceFilter({
	country,
	savedIds,
	value,
	needsSelection = false,
	onChange,
}: {
	country: string;
	savedIds: number[];
	value?: string;
	needsSelection?: boolean;
	onChange: (value: string | undefined) => void;
}) {
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<number[]>([]);
	useEffect(() => {
		if (needsSelection) {
			setDraft([]);
			setOpen(true);
		}
	}, [needsSelection]);
	const insets = useSafeAreaInsets();
	const { data } = useQuery({
		...streamingServicesControllerListOptions({ query: { country } }),
	});
	const myIds = savedIds.filter((id) =>
		data?.services.some((service) => service.id === id),
	);
	const ids = value === "mine" ? myIds : (value?.split(",").map(Number) ?? []);

	return (
		<>
			<View className="flex-row flex-wrap items-center gap-2">
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Streaming services"
					className="flex-row items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
					onPress={() => {
						setDraft(ids);
						setOpen(true);
					}}
				>
					<SlidersHorizontal color="#94a3b8" size={14} />
					<Text className="font-medium text-foreground text-sm">
						Streaming services{value ? ` (${ids.length})` : ""}
					</Text>
					<ChevronDown color="#94a3b8" size={14} />
				</Pressable>
				{value && (
					<Button
						label="Clear filters"
						size="sm"
						variant="secondary"
						onPress={() => {
							setDraft([]);
							setOpen(false);
							onChange(undefined);
						}}
					/>
				)}
			</View>
			<Modal
				visible={open}
				animationType="slide"
				transparent
				onRequestClose={() => setOpen(false)}
			>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : undefined}
					className="flex-1 justify-end bg-black/40"
				>
					<Pressable
						className="flex-1"
						accessibilityLabel="Dismiss service filter"
						onPress={() => setOpen(false)}
					/>
					<View
						className="max-h-[80%] rounded-t-2xl border border-border bg-card"
						style={{ paddingBottom: insets.bottom }}
					>
						<View className="flex-row items-center justify-between px-4 py-3">
							<Text className="font-display font-semibold text-foreground text-lg">
								Streaming services
							</Text>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="Close service filter"
								hitSlop={8}
								onPress={() => setOpen(false)}
							>
								<X color="#94a3b8" size={22} />
							</Pressable>
						</View>
						<ScrollView
							keyboardShouldPersistTaps="handled"
							contentContainerStyle={{ padding: 16, gap: 16 }}
						>
							<Text className="text-muted-foreground text-sm">
								Show episodes on any selected service in {country}.
							</Text>

							<StreamingServicePicker
								country={country}
								value={draft}
								onToggle={(id) => {
									setDraft((ids) => toggleService(ids, id));
								}}
							/>
						</ScrollView>
						<View className="gap-2 border-border border-t p-4">
							<Button
								label="Apply filter"
								disabled={draft.length > 50}
								onPress={() => {
									onChange(
										draft.length
											? [...draft].sort((a, b) => a - b).join(",")
											: undefined,
									);
									setOpen(false);
								}}
							/>
							<Button
								label="Cancel"
								variant="secondary"
								onPress={() => setOpen(false)}
							/>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>
		</>
	);
}
