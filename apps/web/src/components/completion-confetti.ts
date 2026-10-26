import {
	CONFETTI_DURATION,
	createConfettiParticles,
} from "#/lib/confetti-particles";
import { isConfettiEnabled } from "#/lib/confetti-preference";

export function celebrateCompletion() {
	if (
		!isConfettiEnabled() ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	)
		return;
	const overlay = document.createElement("div");
	overlay.setAttribute("aria-hidden", "true");
	overlay.dataset.completionConfetti = "true";
	Object.assign(overlay.style, {
		position: "fixed",
		inset: "0",
		pointerEvents: "none",
		zIndex: "9999",
		overflow: "hidden",
	});
	document.body.append(overlay);
	for (const particle of createConfettiParticles(
		window.innerWidth,
		window.innerHeight,
	)) {
		const piece = document.createElement("span");
		Object.assign(piece.style, {
			position: "absolute",
			left: "0",
			top: "0",
			width: `${particle.width}px`,
			height: `${particle.height}px`,
			backgroundColor: particle.color,
			backfaceVisibility: "visible",
		});
		overlay.append(piece);
		piece.animate(
			particle.frames.map(({ offset, x, y, rotation, tumble, opacity }) => ({
				offset,
				opacity,
				transform: `perspective(600px) translate3d(${x}px, ${y}px, 0) rotateZ(${rotation}deg) rotateX(${tumble}deg)`,
			})),
			{ duration: CONFETTI_DURATION, easing: "linear", fill: "both" },
		);
	}
	window.setTimeout(() => overlay.remove(), CONFETTI_DURATION + 100);
}
