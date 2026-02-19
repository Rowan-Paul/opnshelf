import { Injectable, Logger } from "@nestjs/common";
import { Jimp } from "jimp";

export interface ColorPalette {
	primary: string;
	secondary: string;
	accent: string;
	muted: string;
	[key: string]: string;
}

@Injectable()
export class ColorExtractionService {
	private readonly logger = new Logger(ColorExtractionService.name);
	private readonly tmdbImageBaseUrl = "https://image.tmdb.org/t/p/";
	private readonly uiDarkBackground = { r: 17, g: 24, b: 39 }; // #111827

	async extractColorsFromPoster(
		posterPath: string | null,
	): Promise<ColorPalette | null> {
		if (!posterPath) {
			return null;
		}

		try {
			const imageUrl = `${this.tmdbImageBaseUrl}w342${posterPath}`;
			const image = await Jimp.read(imageUrl);

			// Resize for performance
			image.resize({ w: 100, h: 150 });

			// Get raw pixel data (RGBA format)
			const pixels = image.bitmap.data;

			// Extract and quantize colors
			const colorCounts = new Map<
				string,
				{ r: number; g: number; b: number; count: number }
			>();

			// Sample every 3rd pixel for performance
			for (let i = 0; i < pixels.length; i += 12) {
				const r = pixels[i];
				const g = pixels[i + 1];
				const b = pixels[i + 2];

				// Skip very dark or very light colors
				const brightness = (r + g + b) / 3;
				if (brightness < 30 || brightness > 240) {
					continue;
				}

				// Quantize to reduce color space (group similar colors)
				const quantizedR = Math.round(r / 8) * 8;
				const quantizedG = Math.round(g / 8) * 8;
				const quantizedB = Math.round(b / 8) * 8;
				const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;

				const existing = colorCounts.get(colorKey);
				if (existing) {
					existing.count++;
				} else {
					colorCounts.set(colorKey, {
						r: quantizedR,
						g: quantizedG,
						b: quantizedB,
						count: 1,
					});
				}
			}

			// Score colors by frequency and saturation
			const scoredColors = Array.from(colorCounts.entries()).map(
				([key, { r, g, b, count }]) => {
					const saturation = this.calculateSaturation(r, g, b);
					const score = count * (1 + saturation * 0.5);
					return { key, r, g, b, score, count };
				},
			);

			// Sort by score descending
			scoredColors.sort((a, b) => b.score - a.score);

			// Select top colors ensuring they're not too similar
			const selectedColors: { r: number; g: number; b: number }[] = [];
			for (const color of scoredColors) {
				if (selectedColors.length >= 4) break;

				// Check if this color is different enough from already selected
				let isDifferentEnough = true;
				for (const selected of selectedColors) {
					const distance = this.colorDistance(color, selected);
					if (distance < 40) {
						isDifferentEnough = false;
						break;
					}
				}

				if (isDifferentEnough) {
					selectedColors.push({ r: color.r, g: color.g, b: color.b });
				}
			}

			// If we don't have enough colors, add more without distance check
			if (selectedColors.length < 4) {
				for (const color of scoredColors) {
					if (selectedColors.length >= 4) break;
					const exists = selectedColors.some(
						(selected) =>
							selected.r === color.r &&
							selected.g === color.g &&
							selected.b === color.b,
					);
					if (!exists) {
						selectedColors.push({ r: color.r, g: color.g, b: color.b });
					}
				}
			}

			// Adjust colors to make them more vibrant (boldness boost)
			const adjustedColors = selectedColors.map((color) =>
				this.adjustColorBoldness(color),
			);

			// Ensure we have at least 4 colors
			while (adjustedColors.length < 4) {
				adjustedColors.push({ r: 96, g: 165, b: 250 }); // Accessible fallback blue
			}

			const normalizedPalette = this.normalizePaletteForDarkUi({
				primary: adjustedColors[0],
				secondary: adjustedColors[1],
				accent: adjustedColors[2],
				muted: adjustedColors[3],
			});

			return {
				primary: this.rgbToHex(normalizedPalette.primary),
				secondary: this.rgbToHex(normalizedPalette.secondary),
				accent: this.rgbToHex(normalizedPalette.accent),
				muted: this.rgbToHex(normalizedPalette.muted),
			};
		} catch (error) {
			this.logger.error(
				`Failed to extract colors from poster ${posterPath}:`,
				error,
			);
			return null;
		}
	}

	private calculateSaturation(r: number, g: number, b: number): number {
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const diff = max - min;
		return max === 0 ? 0 : diff / max;
	}

	private colorDistance(
		c1: { r: number; g: number; b: number },
		c2: { r: number; g: number; b: number },
	): number {
		return Math.sqrt(
			(c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2,
		);
	}

	private adjustColorBoldness(color: { r: number; g: number; b: number }): {
		r: number;
		g: number;
		b: number;
	} {
		// Boost saturation
		const max = Math.max(color.r, color.g, color.b);
		const min = Math.min(color.r, color.g, color.b);

		// Increase distance from average
		const boost = 1.3;
		let r = color.r;
		let g = color.g;
		let b = color.b;

		if (max === color.r) {
			r = Math.min(255, Math.round(r * boost));
		} else if (min === color.r) {
			r = Math.max(0, Math.round(r / boost));
		}

		if (max === color.g) {
			g = Math.min(255, Math.round(g * boost));
		} else if (min === color.g) {
			g = Math.max(0, Math.round(g / boost));
		}

		if (max === color.b) {
			b = Math.min(255, Math.round(b * boost));
		} else if (min === color.b) {
			b = Math.max(0, Math.round(b / boost));
		}

		// Ensure minimum brightness
		const brightness = (r + g + b) / 3;
		if (brightness < 60) {
			const boost2 = 60 / brightness;
			r = Math.min(255, Math.round(r * boost2));
			g = Math.min(255, Math.round(g * boost2));
			b = Math.min(255, Math.round(b * boost2));
		}

		return { r, g, b };
	}

	private normalizePaletteForDarkUi(palette: {
		primary: { r: number; g: number; b: number };
		secondary: { r: number; g: number; b: number };
		accent: { r: number; g: number; b: number };
		muted: { r: number; g: number; b: number };
	}) {
		return {
			primary: this.ensureContrastAgainstBackground(
				palette.primary,
				this.uiDarkBackground,
				4.5,
			),
			secondary: this.ensureContrastAgainstBackground(
				palette.secondary,
				this.uiDarkBackground,
				4,
			),
			accent: this.ensureContrastAgainstBackground(
				palette.accent,
				this.uiDarkBackground,
				4.5,
			),
			muted: this.ensureContrastAgainstBackground(
				palette.muted,
				this.uiDarkBackground,
				3,
			),
		};
	}

	private ensureContrastAgainstBackground(
		foreground: { r: number; g: number; b: number },
		background: { r: number; g: number; b: number },
		minContrastRatio: number,
	): { r: number; g: number; b: number } {
		if (this.getContrastRatio(foreground, background) >= minContrastRatio) {
			return foreground;
		}

		// For dark UIs, blend toward white until minimum contrast is reached.
		for (let step = 1; step <= 10; step += 1) {
			const candidate = this.mixColor(
				foreground,
				{ r: 255, g: 255, b: 255 },
				step / 10,
			);
			if (this.getContrastRatio(candidate, background) >= minContrastRatio) {
				return candidate;
			}
		}

		return foreground;
	}

	private getContrastRatio(
		c1: { r: number; g: number; b: number },
		c2: { r: number; g: number; b: number },
	): number {
		const luminance1 = this.getRelativeLuminance(c1);
		const luminance2 = this.getRelativeLuminance(c2);
		const lighter = Math.max(luminance1, luminance2);
		const darker = Math.min(luminance1, luminance2);
		return (lighter + 0.05) / (darker + 0.05);
	}

	private getRelativeLuminance(color: {
		r: number;
		g: number;
		b: number;
	}): number {
		const toLinear = (value: number): number => {
			const normalized = value / 255;
			return normalized <= 0.03928
				? normalized / 12.92
				: ((normalized + 0.055) / 1.055) ** 2.4;
		};

		return (
			0.2126 * toLinear(color.r) +
			0.7152 * toLinear(color.g) +
			0.0722 * toLinear(color.b)
		);
	}

	private mixColor(
		from: { r: number; g: number; b: number },
		to: { r: number; g: number; b: number },
		ratio: number,
	): { r: number; g: number; b: number } {
		const clampedRatio = Math.max(0, Math.min(1, ratio));
		const mixChannel = (a: number, b: number) =>
			Math.round(a + (b - a) * clampedRatio);

		return {
			r: mixChannel(from.r, to.r),
			g: mixChannel(from.g, to.g),
			b: mixChannel(from.b, to.b),
		};
	}

	private rgbToHex(color: { r: number; g: number; b: number }): string {
		const toHex = (n: number) => n.toString(16).padStart(2, "0");
		return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
	}
}
