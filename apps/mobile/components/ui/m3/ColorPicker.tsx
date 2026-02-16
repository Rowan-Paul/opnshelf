import { useState } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { useTheme } from "@/contexts/theme";
import { WARM_COLOR_PRESETS } from "@/constants/material-theme";
import { M3Card, M3CardContent, M3CardHeader, M3CardTitle } from "./M3Card";
import { M3TextField } from "./M3TextField";

interface ColorPickerProps {
	showHeader?: boolean;
}

export function ColorPicker({ showHeader = true }: ColorPickerProps) {
	const { colors, seedColor, setSeedColor } = useTheme();
	const [customColor, setCustomColor] = useState(seedColor);
	const [inputError, setInputError] = useState(false);

	const isValidHex = (hex: string): boolean => {
		return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
	};

	const handlePresetClick = (hex: string) => {
		setCustomColor(hex);
		setSeedColor(hex);
		setInputError(false);
	};

	const handleCustomColorChange = (value: string) => {
		let processedValue = value;
		if (value && !value.startsWith("#")) {
			processedValue = `#${value}`;
		}

		setCustomColor(processedValue);

		if (isValidHex(processedValue)) {
			setSeedColor(processedValue);
			setInputError(false);
		} else if (processedValue.length > 1) {
			setInputError(true);
		}
	};

	return (
		<M3Card variant="elevated">
			{showHeader && (
				<M3CardHeader>
					<M3CardTitle>Theme Color</M3CardTitle>
					<Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
						Customize your app&apos;s accent color
					</Text>
				</M3CardHeader>
			)}
			<M3CardContent style={styles.content}>
				<View style={[styles.preview, { backgroundColor: colors.surfaceContainer }]}>
					<View
						style={[styles.colorPreview, { backgroundColor: seedColor }]}
					/>
					<View style={styles.previewDetails}>
						<Text style={[styles.previewLabel, { color: colors.onSurface }]}>
							Current Color
						</Text>
						<Text
							style={[styles.previewHex, { color: colors.onSurfaceVariant }]}
						>
							{seedColor}
						</Text>
					</View>
				</View>

				<View style={styles.inputContainer}>
					<M3TextField
						label="Custom Color"
						value={customColor}
						onChangeText={handleCustomColorChange}
						error={inputError ? "Invalid hex color" : undefined}
						placeholder="#F59E0B"
						variant="outlined"
						autoCapitalize="none"
						autoCorrect={false}
					/>
				</View>

				<View style={styles.presetsContainer}>
					<Text style={[styles.presetsLabel, { color: colors.onSurfaceVariant }]}>
						Presets
					</Text>
					<View style={styles.presetsGrid}>
						{WARM_COLOR_PRESETS.map((preset) => (
							<Pressable
								key={preset.hex}
								onPress={() => handlePresetClick(preset.hex)}
								style={({ pressed }) => [
									styles.presetButton,
									{ backgroundColor: preset.hex },
									pressed && styles.presetPressed,
									seedColor === preset.hex && styles.presetSelected,
								]}
							>
								{seedColor === preset.hex && (
									<View style={styles.checkmark} />
								)}
							</Pressable>
						))}
					</View>
				</View>
			</M3CardContent>
		</M3Card>
	);
}

const styles = StyleSheet.create({
	subtitle: {
		fontSize: 14,
		marginTop: 4,
	},
	content: {
		gap: 20,
	},
	preview: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
		borderRadius: 8,
		gap: 16,
	},
	colorPreview: {
		width: 48,
		height: 48,
		borderRadius: 24,
	},
	previewDetails: {
		flex: 1,
	},
	previewLabel: {
		fontSize: 14,
		fontWeight: "500",
	},
	previewHex: {
		fontSize: 12,
		marginTop: 2,
	},
	inputContainer: {
		marginTop: 4,
	},
	presetsContainer: {
		gap: 12,
	},
	presetsLabel: {
		fontSize: 12,
		fontWeight: "500",
	},
	presetsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
	},
	presetButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	presetPressed: {
		opacity: 0.7,
	},
	presetSelected: {
		borderWidth: 3,
		borderColor: "rgba(255,255,255,0.5)",
	},
	checkmark: {
		width: 16,
		height: 16,
		borderRadius: 8,
		backgroundColor: "rgba(255,255,255,0.8)",
	},
});
