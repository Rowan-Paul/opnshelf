import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { M3TextField } from "@/components/ui/m3";
import { useTheme } from "@/contexts/theme";
import { ALL_ZONES } from "./constants";
import { styles } from "./styles";

type OnboardingTimezoneModalProps = {
	visible: boolean;
	timezone: string;
	onClose: () => void;
	onSelect: (timezone: string) => void;
};

export function OnboardingTimezoneModal({
	visible,
	timezone,
	onClose,
	onSelect,
}: OnboardingTimezoneModalProps) {
	const { colors } = useTheme();
	const [search, setSearch] = useState("");

	const filteredZones = useMemo(() => {
		if (!search) {
			return ALL_ZONES;
		}

		const normalized = search.toLowerCase();
		return ALL_ZONES.filter(
			(zone) =>
				zone.zone.toLowerCase().includes(normalized) ||
				zone.region.toLowerCase().includes(normalized),
		);
	}, [search]);

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<SafeAreaView
				style={[styles.modalContainer, { backgroundColor: colors.background }]}
				edges={["top", "left", "right", "bottom"]}
			>
				<View
					style={[
						styles.modalHeader,
						{ borderBottomColor: colors.outlineVariant },
					]}
				>
					<Text style={[styles.modalTitle, { color: colors.onSurface }]}>Select Timezone</Text>
					<Button variant="text" size="sm" onPress={onClose}>
						Close
					</Button>
				</View>

				<View style={styles.modalSearchWrap}>
					<M3TextField
						label="Timezone"
						value={search}
						onChangeText={setSearch}
						placeholder="Search timezones..."
						containerStyle={{ width: "100%" }}
						variant="outlined"
					/>
				</View>

				<ScrollView style={styles.modalList}>
					{filteredZones.map((zone) => {
						const isSelected = timezone === zone.zone;
						return (
							<Pressable
								key={zone.zone}
								onPress={() => {
									onSelect(zone.zone);
									onClose();
								}}
								style={[
									styles.zoneItem,
									{
										backgroundColor: isSelected
											? colors.surfaceContainer
											: colors.background,
										borderColor: isSelected
											? colors.primary
											: colors.outlineVariant,
									},
								]}
							>
								<Text
									style={[
										styles.zoneLabel,
										{ color: isSelected ? colors.primary : colors.onSurface },
									]}
								>
									{zone.zone.replace(/_/g, " ")}
								</Text>
								<Text style={[styles.zoneRegion, { color: colors.onSurfaceVariant }]}> 
									{zone.region}
								</Text>
							</Pressable>
						);
					})}
				</ScrollView>
			</SafeAreaView>
		</Modal>
	);
}
