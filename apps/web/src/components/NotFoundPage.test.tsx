// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundPage } from "./NotFoundPage";

let mockPathname = "/missing-route";

vi.mock("@tanstack/react-router", () => ({
	useLocation: () => ({
		pathname: mockPathname,
	}),
}));

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("NotFoundPage", () => {
	let container: HTMLDivElement | null = null;
	let root: Root | null = null;

	afterEach(() => {
		vi.restoreAllMocks();

		if (root && container) {
			act(() => {
				root?.unmount();
			});
		}

		container?.remove();
		container = null;
		root = null;
		mockPathname = "/missing-route";
		window.history.replaceState(null, "", "/");
	});

	function renderPage() {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(<NotFoundPage />);
		});
	}

	it("renders the missing pathname and recovery links", () => {
		mockPathname = "/shows/unknown/finale";

		renderPage();

		expect(container?.textContent).toContain("404");
		expect(container?.textContent).toContain("/shows/unknown/finale");

		const links = Array.from(container?.querySelectorAll("a") ?? []).map(
			(link) => link.getAttribute("href"),
		);

		expect(links).toContain("/");
		expect(links).toContain("/search?q=&type=all");
		expect(container?.textContent).not.toContain("Go back");
	});

	it("shows a back action when browser history is available", () => {
		window.history.pushState(null, "", "/from-dashboard");
		const backSpy = vi
			.spyOn(window.history, "back")
			.mockImplementation(() => undefined);

		renderPage();

		const backButton = Array.from(
			container?.querySelectorAll("button") ?? [],
		).find((button) => button.textContent?.includes("Go back"));

		expect(backButton).toBeTruthy();

		act(() => {
			backButton?.dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});

		expect(backSpy).toHaveBeenCalledTimes(1);
	});
});
