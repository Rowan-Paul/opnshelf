const colors = ["#f59e0b", "#22c55e", "#38bdf8", "#f472b6", "#a78bfa"];

export function celebrateCompletion() {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
	for (let index = 0; index < 48; index++) {
		const piece = document.createElement("span");
		Object.assign(piece.style, {
			position: "absolute",
			left: `${(index * 37) % 100}%`,
			top: "-16px",
			width: "8px",
			height: "12px",
			backgroundColor: colors[index % colors.length],
			borderRadius: "2px",
		});
		overlay.append(piece);
		piece.animate(
			[
				{ transform: "translate(0, -20px) rotate(0deg)", opacity: 1 },
				{
					transform: `translate(${(index % 2 ? 1 : -1) * (30 + index * 2)}px, ${window.innerHeight + 40}px) rotate(${360 + index * 23}deg)`,
					opacity: 0,
				},
			],
			{
				duration: 1800 + (index % 5) * 120,
				delay: (index % 7) * 35,
				easing: "cubic-bezier(.15,.4,.65,1)",
			},
		);
	}
	window.setTimeout(() => overlay.remove(), 2600);
}
