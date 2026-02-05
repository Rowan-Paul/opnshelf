import { useEffect, useState } from "react";

interface PosterColors {
	primary: string;
	secondary: string;
	accent: string;
	muted: string;
}

function getImageUrl(path: string | null | undefined): string | null {
	if (!path) return null;
	return `https://image.tmdb.org/t/p/w342${path}`;
}

function rgbToHex(r: number, g: number, b: number): string {
	return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function getBrightness(r: number, g: number, b: number): number {
	return (r * 299 + g * 587 + b * 114) / 1000;
}

function getSaturation(r: number, g: number, b: number): number {
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	if (max === 0) return 0;
	return (max - min) / max;
}

function adjustColorForBoldness(
	r: number,
	g: number,
	b: number,
): [number, number, number] {
	// Increase saturation and ensure vibrancy
	const avg = (r + g + b) / 3;
	const saturationBoost = 1.4;

	let nr = Math.min(255, avg + (r - avg) * saturationBoost);
	let ng = Math.min(255, avg + (g - avg) * saturationBoost);
	let nb = Math.min(255, avg + (b - avg) * saturationBoost);

	// Ensure minimum brightness for visibility
	const brightness = getBrightness(nr, ng, nb);
	if (brightness < 80) {
		const boost = (80 - brightness) / 2;
		nr = Math.min(255, nr + boost);
		ng = Math.min(255, ng + boost);
		nb = Math.min(255, nb + boost);
	}

	return [Math.round(nr), Math.round(ng), Math.round(nb)];
}

export function usePosterColors(
	posterPath: string | null | undefined,
): PosterColors {
	const [colors, setColors] = useState<PosterColors>({
		primary: "#8b5cf6", // Default purple
		secondary: "#6366f1", // Default indigo
		accent: "#a855f7", // Default purple
		muted: "#4c1d95", // Default dark purple
	});

	useEffect(() => {
		const url = getImageUrl(posterPath);
		if (!url) return;

		const img = new Image();
		img.crossOrigin = "anonymous";

		img.onload = () => {
			try {
				const canvas = document.createElement("canvas");
				const ctx = canvas.getContext("2d");
				if (!ctx) return;

				// Resize for performance while keeping enough detail
				canvas.width = 100;
				canvas.height = 150;
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const data = imageData.data;

				// Collect color samples with their frequency and saturation
				const colorMap = new Map<
					string,
					{ r: number; g: number; b: number; count: number; saturation: number }
				>();

				for (let i = 0; i < data.length; i += 4 * 3) {
					// Sample every 3rd pixel for performance
					const r = data[i];
					const g = data[i + 1];
					const b = data[i + 2];

					// Skip very dark or very light colors
					const brightness = getBrightness(r, g, b);
					if (brightness < 30 || brightness > 240) continue;

					// Quantize colors slightly for grouping
					const qr = Math.round(r / 8) * 8;
					const qg = Math.round(g / 8) * 8;
					const qb = Math.round(b / 8) * 8;
					const key = `${qr},${qg},${qb}`;

					const saturation = getSaturation(qr, qg, qb);
					const existing = colorMap.get(key);
					if (existing) {
						existing.count++;
					} else {
						colorMap.set(key, {
							r: qr,
							g: qg,
							b: qb,
							count: 1,
							saturation,
						});
					}
				}

				// Sort by a combination of count and saturation (weighted toward saturation for boldness)
				const sortedColors = Array.from(colorMap.values()).sort((a, b) => {
					const scoreA = a.count * (1 + a.saturation * 2);
					const scoreB = b.count * (1 + b.saturation * 2);
					return scoreB - scoreA;
				});

				if (sortedColors.length > 0) {
					// Primary: Most prominent vibrant color
					const primary = sortedColors[0];
					const [pr, pg, pb] = adjustColorForBoldness(
						primary.r,
						primary.g,
						primary.b,
					);

					// Secondary: Different hue from sorted colors
					let secondary = sortedColors[Math.min(2, sortedColors.length - 1)];
					for (const color of sortedColors.slice(1)) {
						const hueDiff = Math.abs(
							primary.r - primary.g - (color.r - color.g),
						);
						if (hueDiff > 30) {
							secondary = color;
							break;
						}
					}
					const [sr, sg, sb] = adjustColorForBoldness(
						secondary.r,
						secondary.g,
						secondary.b,
					);

					// Accent: Blend of primary and secondary
					const [ar, ag, ab] = [
						Math.round((pr + sr * 2) / 3),
						Math.round((pg + sg * 2) / 3),
						Math.round((pb + sb * 2) / 3),
					];

					// Muted: Darker version of primary
					const [mr, mg, mb] = [
						Math.round(pr * 0.4),
						Math.round(pg * 0.4),
						Math.round(pb * 0.4),
					];

					setColors({
						primary: rgbToHex(pr, pg, pb),
						secondary: rgbToHex(sr, sg, sb),
						accent: rgbToHex(ar, ag, ab),
						muted: rgbToHex(mr, mg, mb),
					});
				}
			} catch {
				// Keep defaults on error
			}
		};

		img.src = url;
	}, [posterPath]);

	return colors;
}
