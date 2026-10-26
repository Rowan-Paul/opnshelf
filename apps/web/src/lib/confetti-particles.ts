// Matching cannon physics on Web and Mobile: an inward launch, air drag and gravity.
export const CONFETTI_DURATION = 3600;
const colors = [
	"#ff3b30",
	"#ffcc00",
	"#34c759",
	"#00c7ff",
	"#ff2d92",
	"#8b5cff",
];
export function createConfettiParticles(width: number, height: number) {
	const size = Math.max(0.6, Math.min(1, width / 800));
	// Bound setup and rendering: 64 pieces, 25 trajectory samples each.
	return Array.from({ length: 64 }, (_, id) => {
		const right = id % 2 === 1;
		const velocityX = width * (0.7 + Math.random() * 1.25);
		const velocityY = height * (1.1 + Math.random() * 0.65);
		const delay = Math.random() * 0.18;
		const spin = (Math.random() - 0.5) * 1800;
		const tumble = 720 + Math.random() * 1440;
		const angle = Math.random() * 360;
		return {
			id,
			color: colors[id % colors.length],
			width: (5 + Math.random() * 6) * size,
			height: (6 + Math.random() * 9) * size,
			frames: Array.from({ length: 25 }, (_, step) => {
				const offset = step / 24;
				const time = Math.max(0, (offset * CONFETTI_DURATION) / 1000 - delay);
				const travel = (velocityX * (1 - Math.exp(-1.6 * time))) / 1.6;
				return {
					offset,
					x: right ? width - 12 - travel : 12 + travel,
					y: height + 16 - velocityY * time + 0.575 * height * time * time,
					rotation: angle + spin * time,
					tumble: tumble * time,
					opacity: time === 0 ? 0 : Math.min(1, (1 - offset) * 5),
				};
			}),
		};
	});
}
