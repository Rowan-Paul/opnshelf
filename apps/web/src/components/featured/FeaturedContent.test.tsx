import {
	activeFeaturedItems,
	type FeaturedDto,
	featuredMediaPath,
	featuredTitle,
} from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { datetimeLocalToISO } from "#/lib/date-utils";
import { featuredExpiryInput } from "./editor-dates";
import { FeaturedCard, FeaturedContent } from "./FeaturedContent";

vi.mock("#/lib/auth-context", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));
const item: FeaturedDto = {
	id: "pick",
	mediaType: "season",
	mediaId: 1399,
	seasonNumber: 0,
	title: "Game of Thrones",
	posterPath: null,
	message: "A new trailer",
	sourceUrl: "https://example.com/trailer",
	sourceLabel: "Watch trailer",
	expiresAt: "2099-01-01T00:00:00Z",
	active: true,
};
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});
describe("Featured Content reader", () => {
	it("links the exact season separately from its source", () => {
		render(<FeaturedCard item={item} />);
		expect(
			screen
				.getByRole("link", { name: /Game of Thrones/ })
				.getAttribute("href"),
		).toBe("/shows/1399/game-of-thrones/seasons/0");
		expect(
			screen.getByRole("link", { name: "Watch trailer" }).getAttribute("href"),
		).toBe(item.sourceUrl);
		expect(featuredTitle(item)).toBe("Game of Thrones · Specials");
		expect(featuredMediaPath({ ...item, mediaType: "movie" })).toBe(
			"/movies/1399/game-of-thrones",
		);
	});
	it("hides expired picks even when cached data still reports active", () => {
		expect(activeFeaturedItems([item], Date.parse(item.expiresAt))).toEqual([]);
	});
	it("removes a cached pick at expiry without waiting for another request", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
		const client = new QueryClient({
			defaultOptions: { queries: { enabled: false } },
		});
		client.setQueryData(
			[
				{
					_id: "featuredControllerSelection",
					baseUrl: "http://127.0.0.1:3001",
				},
			],
			{ items: [] },
		);
		// Seed the exact generated key while disabling network for this expiry test.
		const { featuredControllerSelectionOptions } = await import(
			"@opnshelf/api"
		);
		client.setQueryData(featuredControllerSelectionOptions().queryKey, {
			items: [{ ...item, expiresAt: "2026-10-03T12:00:02Z" }],
		});
		render(
			<QueryClientProvider client={client}>
				<FeaturedContent />
			</QueryClientProvider>,
		);
		expect(screen.getByText("A new trailer")).toBeTruthy();
		act(() => {
			vi.advanceTimersByTime(3000);
		});
		expect(screen.queryByText("A new trailer")).toBeNull();
		expect(
			screen.queryByRole("region", { name: "Featured Content" }),
		).toBeNull();
		client.clear();
	});
	it.each([
		"2026-01-03T12:45:00Z",
		"2026-07-03T12:45:00Z",
	])("round-trips expiry in the admin's timezone: %s", (iso) => {
		expect(
			datetimeLocalToISO(
				featuredExpiryInput(iso, "Europe/Amsterdam"),
				"Europe/Amsterdam",
			),
		).toBe(new Date(iso).toISOString());
	});
});
