// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { TrailerSection } from "./TrailerSection";

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("TrailerSection", () => {
	let container: HTMLDivElement | null = null;
	let root: Root | null = null;

	afterEach(() => {
		if (root && container) {
			act(() => {
				root?.unmount();
			});
		}
		container?.remove();
		container = null;
		root = null;
	});

	it("renders nothing without a trailer", () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(<TrailerSection mediaType="movie" />);
		});

		expect(container.innerHTML).toBe("");
	});

	it("shows a fallback badge when using the parent show trailer", () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(
				<TrailerSection
					mediaType="season"
					showTrailer={{
						id: "show-trailer",
						key: "abc123",
						name: "Show Trailer",
						site: "YouTube",
						type: "Trailer",
						sourceMediaType: "show",
					}}
				/>,
			);
		});

		expect(container.textContent).toContain("From show");
		expect(container.textContent).toContain("Show Trailer");
	});

	it("swaps the preview for an iframe when clicked", () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(
				<TrailerSection
					mediaType="movie"
					detailTrailer={{
						id: "movie-trailer",
						key: "xyz789",
						name: "Movie Trailer",
						site: "YouTube",
						type: "Trailer",
						sourceMediaType: "movie",
					}}
				/>,
			);
		});

		const previewButton = container.querySelector("button");
		expect(previewButton).not.toBeNull();

		act(() => {
			previewButton?.dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			);
		});

		const iframe = container.querySelector("iframe");
		expect(iframe).not.toBeNull();
		expect(iframe?.getAttribute("src")).toContain(
			"youtube-nocookie.com/embed/xyz789",
		);
		expect(iframe?.getAttribute("src")).toContain("autoplay=1");
	});
});
