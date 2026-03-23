// @vitest-environment jsdom

import type { UpNextShowDto } from "@opnshelf/api";
import {
	act,
	type ComponentProps,
	type MouseEventHandler,
	type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpNextShowCollection } from "./UpNextShowCollection";

vi.mock("@tanstack/react-query", () => ({
	useMutation: () => ({
		isPending: false,
		mutate: vi.fn(),
		variables: undefined,
	}),
	useQueryClient: () => ({
		invalidateQueries: vi.fn(),
	}),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		className,
		onClick,
	}: {
		children: ReactNode;
		className?: string;
		onClick?: MouseEventHandler<HTMLAnchorElement>;
	}) => (
		<a href="#" className={className} onClick={onClick}>
			{children}
		</a>
	),
}));

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const sampleItems: UpNextShowDto[] = [
	{
		showId: "show-1",
		watchCount: 3,
		latestWatchedDate: "2026-03-20T12:00:00.000Z",
		lastWatched: {
			seasonNumber: 1,
			episodeNumber: 2,
		},
		nextEpisode: {
			seasonNumber: 1,
			episodeNumber: 3,
			name: "The Third Episode",
			airDate: "2026-03-18",
			overview: "Next up",
		},
		show: {
			showId: "show-1",
			title: "Show One",
			posterPath: "/poster-one.jpg",
		},
	},
	{
		showId: "show-2",
		watchCount: 7,
		latestWatchedDate: "2026-03-19T12:00:00.000Z",
		lastWatched: {
			seasonNumber: 2,
			episodeNumber: 4,
		},
		nextEpisode: {
			seasonNumber: 2,
			episodeNumber: 5,
			name: "Another Episode",
			airDate: "2026-03-17",
			overview: "Still watching",
		},
		show: {
			showId: "show-2",
			title: "Show Two",
			posterPath: "/poster-two.jpg",
		},
	},
];

function findCardGrid(container: HTMLDivElement) {
	return Array.from(container.querySelectorAll("div")).find((element) => {
		const className = element.getAttribute("class") ?? "";
		return (
			className.includes("grid-cols-1") &&
			className.includes("xl:grid-cols-2") &&
			className.includes("gap-4")
		);
	});
}

function renderCollection(
	props: Partial<ComponentProps<typeof UpNextShowCollection>> = {},
) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(
			<UpNextShowCollection
				isFetching={false}
				isLoading={false}
				upNext={sampleItems}
				userDid="did:plc:test"
				showHeader={false}
				variant="dashboard"
				{...props}
			/>,
		);
	});

	return { container, root };
}

describe("UpNextShowCollection", () => {
	let mounted: { container: HTMLDivElement; root: Root } | null = null;

	afterEach(() => {
		if (mounted) {
			act(() => {
				mounted?.root.unmount();
			});
			mounted.container.remove();
			mounted = null;
		}
	});

	it("keeps the loaded grid fully interactive when not refetching", () => {
		mounted = renderCollection();

		const cardGrid = findCardGrid(mounted.container);

		expect(cardGrid).toBeTruthy();
		expect(cardGrid?.style.opacity).toBe("1");
		expect(cardGrid?.className).toContain("transition-opacity");
		expect(cardGrid?.className).not.toContain("pointer-events-none");
		expect(cardGrid?.getAttribute("aria-busy")).toBeNull();
	});

	it("dims and disables the loaded grid while refetching", () => {
		mounted = renderCollection({ isFetching: true });

		const cardGrid = findCardGrid(mounted.container);

		expect(cardGrid).toBeTruthy();
		expect(cardGrid?.style.opacity).toBe("0.58");
		expect(cardGrid?.className).toContain("pointer-events-none");
		expect(cardGrid?.getAttribute("aria-busy")).toBe("true");
	});

	it("shows skeletons instead of the dimmed grid during initial load", () => {
		mounted = renderCollection({
			isFetching: true,
			isLoading: true,
			upNext: [],
		});

		const refreshingGrid =
			mounted.container.querySelector('[aria-busy="true"]');
		const watchButtons = Array.from(
			mounted.container.querySelectorAll("button"),
		).filter((button) => button.textContent?.includes("Watch"));

		expect(refreshingGrid).toBeNull();
		expect(watchButtons).toHaveLength(0);
		expect(mounted.container.querySelectorAll("img")).toHaveLength(0);
	});

	it("does not apply the refresh treatment to the empty state", () => {
		mounted = renderCollection({ isFetching: true, upNext: [] });

		expect(mounted.container.textContent).toContain("Nothing queued up yet");
		expect(mounted.container.querySelector('[aria-busy="true"]')).toBeNull();
		expect(findCardGrid(mounted.container)).toBeUndefined();
	});
});
