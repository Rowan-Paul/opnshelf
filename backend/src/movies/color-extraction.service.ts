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
				adjustedColors.push({ r: 139, g: 92, b: 246 }); // Fallback purple
			}

			return {
				primary: this.rgbToHex(adjustedColors[0]),
				secondary: this.rgbToHex(adjustedColors[1]),
				accent: this.rgbToHex(adjustedColors[2]),
				muted: this.rgbToHex(adjustedColors[3]),
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

	private rgbToHex(color: { r: number; g: number; b: number }): string {
		const toHex = (n: number) => n.toString(16).padStart(2, "0");
		return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
	}
}
