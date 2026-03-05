import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { M3TextField } from "@/components/ui/m3";
import type { ExtendedThemeColors } from "@/constants/extended-theme";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { ALL_ZONES } from "./timezones";

interface TimezoneModalProps {
	visible: boolean;
	timezone: string;
	onClose: () => void;
	onSelectTimezone: (timezone: string) => void;
}

export function TimezoneModal({
	visible,
	timezone,
	onClose,
	onSelectTimezone,
}: TimezoneModalProps) {
	const { colors } = useTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const [search, setSearch] = useState("");

	useEffect(() => {
		if (!visible) {
			setSearch("");
		}
	}, [visible]);

	const filteredZones = useMemo(() => {
		if (!search) {
			return ALL_ZONES;
		}

		const lowerSearch = search.toLowerCase();
		return ALL_ZONES.filter(
			(zone) =>
				zone.zone.toLowerCase().includes(lowerSearch) ||
				zone.region.toLowerCase().includes(lowerSearch),
		);
	}, [search]);

	return (
		<Modal
			visible={visible}
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<SafeAreaView style={styles.modalContainer}>
				<View style={styles.modalHeader}>
					<Text style={styles.modalTitle}>Select Timezone</Text>
					<Button variant="text" size="sm" onPress={onClose}>
						<Text style={styles.modalCloseText}>Close</Text>
					</Button>
				</View>

				<M3TextField
					label="Timezone"
					containerStyle={styles.searchInput}
					placeholder="Search timezones..."
					value={search}
					onChangeText={setSearch}
					variant="outlined"
				/>

				<ScrollView style={styles.modalScroll}>
					{filteredZones.map((zone) => (
						<Pressable
							key={zone.zone}
							style={[
								styles.zoneItem,
								timezone === zone.zone && styles.zoneItemActive,
							]}
							onPress={() => onSelectTimezone(zone.zone)}
						>
							<Text
								style={[
									styles.zoneText,
									timezone === zone.zone && styles.zoneTextActive,
								]}
							>
								{zone.zone.replace(/_/g, " ")}
							</Text>
							<Text style={styles.zoneRegion}>{zone.region}</Text>
						</Pressable>
					))}
				</ScrollView>

			</SafeAreaView>
		</Modal>
	);
}

const createStyles = (colors: ExtendedThemeColors) =>
	StyleSheet.create({
		modalContainer: {
			flex: 1,
			backgroundColor: colors.background,
		},
		modalHeader: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: spacing.lg,
			paddingVertical: spacing.md,
			borderBottomWidth: 1,
			borderBottomColor: colors.border,
		},
		modalTitle: {
			fontSize: 18,
			fontWeight: "600",
			color: colors.text,
		},
		modalCloseText: {
			color: colors.primary,
			fontSize: 16,
			fontWeight: "500",
		},
		searchInput: {
			marginHorizontal: spacing.lg,
			marginVertical: spacing.md,
		},
		modalScroll: {
			flex: 1,
			paddingHorizontal: spacing.lg,
		},
		zoneItem: {
			paddingVertical: spacing.md,
			paddingHorizontal: spacing.md,
			borderRadius: borderRadius.md,
			marginBottom: spacing.xs,
		},
		zoneItemActive: {
			backgroundColor: colors.card,
		},
		zoneText: {
			fontSize: 16,
			color: colors.text,
			fontWeight: "500",
		},
		zoneTextActive: {
			color: colors.primary,
		},
		zoneRegion: {
			fontSize: 12,
			color: colors.textMuted,
			marginTop: spacing.xs / 2,
		},
	});
