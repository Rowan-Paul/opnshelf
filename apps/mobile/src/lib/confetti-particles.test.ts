import { expect, it, vi } from "vitest";
import { createConfettiParticles } from "./confetti-particles";

it("launches both cannons upward, spreads inward, then falls below the screen", () => {
	vi.spyOn(Math, "random").mockReturnValue(0.5);
	const particles = createConfettiParticles(1000, 800);
	expect(particles).toHaveLength(64);
	expect(particles.every((particle) => particle.frames.length === 25)).toBe(
		true,
	);
	const left = particles[0].frames;
	const right = particles[1].frames;
	expect(left[0].x).toBe(12);
	expect(right[0].x).toBe(988);
	expect(left[10].x).toBeGreaterThan(left[0].x);
	expect(right[10].x).toBeLessThan(right[0].x);
	expect(left[10].y).toBeLessThan(left[0].y);
	expect(left.at(-1)?.y).toBeGreaterThan(800);
	expect(left.at(-1)?.opacity).toBe(0);
	expect(createConfettiParticles(390, 800)[0].width).toBeCloseTo(4.8);
	vi.restoreAllMocks();
});
