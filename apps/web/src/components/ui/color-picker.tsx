import { Palette } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { WARM_COLOR_PRESETS } from "@/lib/material-theme";
import { cn } from "@/lib/utils";
import { M3Card, M3CardContent, M3CardHeader, M3CardTitle } from "./m3-card";

/**
 * Color Picker Component for Material You Theme Customization
 *
 * Allows users to:
 * - Select from preset warm colors
 * - Enter a custom hex color
 * - See live preview of generated palette
 */

interface ColorPreset {
	name: string;
	hex: string;
}

const COLOR_PRESETS: ColorPreset[] = WARM_COLOR_PRESETS;

function isValidHex(hex: string): boolean {
	return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}

export function ColorPicker() {
	const { seedColor, setSeedColor } = useTheme();
	const [customColor, setCustomColor] = useState(seedColor);
	const [inputError, setInputError] = useState(false);

	const handlePresetClick = (hex: string) => {
		setCustomColor(hex);
		setSeedColor(hex);
		setInputError(false);
	};

	const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let value = e.target.value;

		// Auto-add # if not present
		if (value && !value.startsWith("#")) {
			value = `#${value}`;
		}

		setCustomColor(value);

		if (isValidHex(value)) {
			setSeedColor(value);
			setInputError(false);
		} else if (value.length > 1) {
			setInputError(true);
		}
	};

	return (
		<M3Card variant="elevated">
			<M3CardHeader>
				<div className="flex items-center gap-3">
					<div
						className="p-2 rounded-lg"
						style={{
							backgroundColor: `${seedColor}20`,
						}}
					>
						<Palette className="w-5 h-5" style={{ color: seedColor }} />
					</div>
					<div>
						<M3CardTitle>Theme Color</M3CardTitle>
						<p className="md-body-medium text-[var(--md-sys-color-on-surface-variant)]">
							Customize your app&apos;s accent color
						</p>
					</div>
				</div>
			</M3CardHeader>
			<M3CardContent className="space-y-6">
				{/* Current Color Preview */}
				<div className="flex items-center gap-4 p-4 rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-surface-container)]">
					<div
						className="w-16 h-16 rounded-[var(--md-sys-shape-corner-medium)] shadow-lg"
						style={{ backgroundColor: seedColor }}
					/>
					<div>
						<p className="md-title-small text-[var(--md-sys-color-on-surface)]">
							Current Color
						</p>
						<p className="md-body-large font-mono text-[var(--md-sys-color-on-surface-variant)]">
							{seedColor.toUpperCase()}
						</p>
					</div>
				</div>

				{/* Preset Colors */}
				<div>
					<p className="md-label-large text-[var(--md-sys-color-on-surface)] mb-3">
						Preset Colors
					</p>
					<div className="flex flex-wrap gap-2">
						{COLOR_PRESETS.map((preset) => (
							<button
								key={preset.hex}
								type="button"
								onClick={() => handlePresetClick(preset.hex)}
								className={cn(
									"group relative flex items-center gap-2 px-3 py-2 rounded-[var(--md-sys-shape-corner-small)]",
									"border transition-all duration-200",
									"hover:scale-105",
									seedColor.toLowerCase() === preset.hex.toLowerCase()
										? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]"
										: "border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)]",
								)}
								title={preset.name}
							>
								<div
									className="w-5 h-5 rounded-full border border-black/10"
									style={{ backgroundColor: preset.hex }}
								/>
								<span className="md-body-medium text-[var(--md-sys-color-on-surface)]">
									{preset.name}
								</span>
								{seedColor.toLowerCase() === preset.hex.toLowerCase() && (
									<div className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--md-sys-color-primary)] rounded-full border-2 border-[var(--md-sys-color-surface)]" />
								)}
							</button>
						))}
					</div>
				</div>

				{/* Custom Color Input */}
				<div>
					<p className="md-label-large text-[var(--md-sys-color-on-surface)] mb-3">
						Custom Color
					</p>
					<div className="flex gap-3">
						<div className="relative flex-1">
							<input
								type="text"
								value={customColor}
								onChange={handleCustomColorChange}
								placeholder="#F59E0B"
								className={cn(
									"w-full px-4 py-3 rounded-[var(--md-sys-shape-corner-small)]",
									"bg-[var(--md-sys-color-surface-container)]",
									"text-[var(--md-sys-color-on-surface)] font-mono",
									"border-2 transition-colors",
									"outline-none",
									inputError
										? "border-[var(--md-sys-color-error)]"
										: "border-[var(--md-sys-color-outline)] focus:border-[var(--md-sys-color-primary)]",
								)}
							/>
							{inputError && (
								<p className="mt-1 text-sm text-[var(--md-sys-color-error)]">
									Invalid hex color
								</p>
							)}
						</div>
						<div
							className="w-14 h-14 rounded-[var(--md-sys-shape-corner-small)] border-2 border-[var(--md-sys-color-outline)]"
							style={{
								backgroundColor: isValidHex(customColor)
									? customColor
									: seedColor,
							}}
						/>
					</div>
					<p className="mt-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
						Enter any hex color code (e.g., #FF6B6B, #3B82F6)
					</p>
				</div>

				{/* Color Preview Section */}
				<div className="pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
					<p className="md-label-large text-[var(--md-sys-color-on-surface)] mb-3">
						Generated Palette Preview
					</p>
					<div className="grid grid-cols-5 gap-2">
						{[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((tone) => (
							<div key={tone} className="flex flex-col items-center gap-1">
								<div
									className="w-full h-8 rounded-[var(--md-sys-shape-corner-small)]"
									style={{
										backgroundColor: seedColor,
										opacity: tone === 0 ? 1 : tone / 100,
										filter: tone === 0 ? "brightness(0.1)" : "none",
									}}
								/>
								<span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
									{tone}
								</span>
							</div>
						))}
					</div>
				</div>
			</M3CardContent>
		</M3Card>
	);
}
