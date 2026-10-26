import { afterEach, expect, it, vi } from "vitest";
import { celebrateCompletion } from "./completion-confetti";

afterEach(() => {
	document.querySelectorAll("[data-completion-confetti]").forEach((element) => {
		element.remove();
	});
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});
it("respects reduced motion", () => {
	vi.stubGlobal("matchMedia", () => ({ matches: true }));
	celebrateCompletion();
	expect(document.querySelector("[data-completion-confetti]")).toBeNull();
});
it("renders one non-interactive decorative burst and removes it", () => {
	vi.useFakeTimers();
	vi.stubGlobal("matchMedia", () => ({ matches: false }));
	const animate = vi.fn();
	Object.defineProperty(Element.prototype, "animate", {
		configurable: true,
		value: animate,
	});
	celebrateCompletion();
	const overlay = document.querySelector<HTMLElement>(
		"[data-completion-confetti]",
	);
	expect(overlay?.children.length).toBe(48);
	expect(overlay?.style.pointerEvents).toBe("none");
	expect(overlay?.getAttribute("aria-hidden")).toBe("true");
	expect(animate).toHaveBeenCalledTimes(48);
	vi.advanceTimersByTime(2600);
	expect(document.querySelector("[data-completion-confetti]")).toBeNull();
	delete (Element.prototype as Partial<Element>).animate;
});
