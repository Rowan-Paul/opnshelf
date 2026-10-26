import { afterEach, expect, it, vi } from "vitest";
import { celebrateCompletion } from "./completion-confetti";

afterEach(() => {
	document.querySelectorAll("[data-completion-confetti]").forEach((element) => {
		element.remove();
	});
	window.localStorage.removeItem("opnshelf_completion_confetti");
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
	for (let i = 0; i < 100; i++) celebrateCompletion();
	expect(document.querySelectorAll("[data-completion-confetti]")).toHaveLength(
		1,
	);
	const overlay = document.querySelector<HTMLElement>(
		"[data-completion-confetti]",
	);
	expect(overlay?.children.length).toBe(64);
	expect(overlay?.style.pointerEvents).toBe("none");
	expect(overlay?.getAttribute("aria-hidden")).toBe("true");
	expect(animate).toHaveBeenCalledTimes(64);
	vi.advanceTimersByTime(3700);
	expect(document.querySelector("[data-completion-confetti]")).toBeNull();
	delete (Element.prototype as Partial<Element>).animate;
});

it("does not animate when disabled in Settings", () => {
	window.localStorage.setItem("opnshelf_completion_confetti", "false");
	vi.stubGlobal("matchMedia", () => ({ matches: false }));
	celebrateCompletion();
	expect(document.querySelector("[data-completion-confetti]")).toBeNull();
});
