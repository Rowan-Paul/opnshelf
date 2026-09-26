import type { UpNextShowDto } from "@opnshelf/api";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpNextEpisodeCard } from "./UpNextEpisodeCard";

const mocks = vi.hoisted(() => ({ useMark: vi.fn(), mutate: vi.fn() }));
vi.mock("#/lib/hooks", () => ({ useMarkEpisodeWatched: mocks.useMark }));
vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		params,
		...props
	}: {
		children: ReactNode;
		params: Record<string, string>;
	}) => (
		<a
			{...props}
			href={`/shows/${params.showId}/${params.showName}/seasons/${params.seasonNumber}/episodes/${params.episodeNumber}`}
		>
			{children}
		</a>
	),
}));
const item: UpNextShowDto = {
	showId: "1",
	show: { showId: "1", title: "Severance", backdropPath: "/backdrop.jpg" },
	nextEpisode: {
		seasonNumber: 2,
		episodeNumber: 3,
		name: "Next episode",
		stillPath: "/episode.jpg",
	},
	episodesWatched: 5,
	totalEpisodes: 20,
	latestWatchedDate: "2026-01-01",
	lastWatched: { seasonNumber: 2, episodeNumber: 2 },
};
beforeEach(() => {
	vi.clearAllMocks();
	mocks.useMark.mockReturnValue({ mutate: mocks.mutate, isPending: false });
});
describe("Up Next episode tile", () => {
	it("falls back from a failed episode still to the backdrop, then a placeholder", () => {
		const { container } = render(<UpNextEpisodeCard item={item} isOwner />);
		const still = container.querySelector("img");
		expect(still?.getAttribute("src")).toContain("/episode.jpg");
		if (!still) throw new Error("Missing episode still");
		fireEvent.error(still);
		const backdrop = container.querySelector("img");
		expect(backdrop?.getAttribute("src")).toContain("/backdrop.jpg");
		if (!backdrop) throw new Error("Missing backdrop");
		fireEvent.error(backdrop);
		expect(container.querySelector("img")).toBeNull();
		expect(
			screen.getByRole("link", { name: /Severance/ }).getAttribute("href"),
		).toBe("/shows/1/severance/seasons/2/episodes/3");
	});
	it("marks the displayed episode and keeps another card available during a pending action", () => {
		mocks.useMark.mockReturnValueOnce({
			mutate: mocks.mutate,
			isPending: true,
		});
		render(
			<>
				<UpNextEpisodeCard item={item} isOwner />
				<UpNextEpisodeCard item={{ ...item, showId: "2" }} isOwner />
			</>,
		);
		expect(
			screen.getByRole("button", { name: "Adding…" }).hasAttribute("disabled"),
		).toBe(true);
		const add = screen.getByRole("button", { name: "Add to shelf" });
		expect(add.hasAttribute("disabled")).toBe(false);
		fireEvent.click(add);
		expect(mocks.mutate).toHaveBeenCalledWith({
			body: { showId: "2", seasonNumber: 2, episodeNumber: 3 },
		});
	});
	it("keeps other users' queues read-only and displays the viewer's progress", () => {
		render(
			<UpNextEpisodeCard
				item={item}
				isOwner={false}
				progress={{ episodesWatched: 2, episodesTotal: 20 }}
			/>,
		);
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByText("2 of 20 watched")).toBeTruthy();
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
			"10",
		);
	});
});
