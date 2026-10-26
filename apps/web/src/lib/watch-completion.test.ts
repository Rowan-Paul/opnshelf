import type { ShowProgressDto } from "@opnshelf/api";
import { hashKey, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
	cachedCompletionProgress,
	celebrateWatchCompletion,
	newlyCompleted,
	readCompletionProgress,
} from "./watch-completion";

const mocks = vi.hoisted(() => ({
	get: vi.fn(),
	celebrate: vi.fn(),
	enabled: vi.fn(() => true),
}));
vi.mock("@opnshelf/api", () => ({ showsControllerGetShowProgress: mocks.get }));
vi.mock("#/components/completion-confetti", () => ({
	celebrateCompletion: mocks.celebrate,
}));
vi.mock("#/lib/confetti-preference", () => ({
	isConfettiEnabled: mocks.enabled,
}));
function progress(watched: number, total = 2): ShowProgressDto {
	return {
		showId: "42",
		hasWatches: watched > 0,
		episodesWatched: watched,
		episodesTotal: total,
		remainingEpisodes: total - watched,
		percentage: (watched / total) * 100,
		state: watched === total ? "complete" : "partial",
		seasons: [
			{
				seasonNumber: 1,
				episodesWatched: watched,
				episodesTotal: total,
				remainingEpisodes: total - watched,
				percentage: (watched / total) * 100,
				state: watched === total ? "complete" : "partial",
			},
		],
	};
}
describe("Watch completion", () => {
	it("celebrates completion, including a season while the show is incomplete", () => {
		expect(newlyCompleted(progress(1), progress(2), 1)).toBe(true);
		const after = {
			...progress(2),
			state: "partial" as const,
			episodesTotal: 4,
		};
		expect(newlyCompleted(progress(1), after, 1)).toBe(true);
		expect(newlyCompleted(progress(1), after, 2)).toBe(false);
	});
	it("ignores revisits, rewatches, incomplete, empty and unknown progress", () => {
		expect(newlyCompleted(progress(2), progress(2))).toBe(false);
		expect(newlyCompleted(progress(0), progress(1))).toBe(false);
		expect(newlyCompleted(progress(0, 0), progress(0, 0))).toBe(false);
		expect(newlyCompleted(undefined, progress(2))).toBe(false);
		expect(newlyCompleted(progress(1), undefined)).toBe(false);
		expect(
			newlyCompleted({ ...progress(1), state: "unavailable" }, progress(2)),
		).toBe(false);
	});
	it("checks confirmed server progress and tolerates failed reads", async () => {
		mocks.get.mockResolvedValueOnce({ data: { items: [progress(2)] } });
		await celebrateWatchCompletion(progress(1), 1);
		expect(mocks.celebrate).toHaveBeenCalledTimes(1);
		mocks.get.mockRejectedValueOnce(new Error("offline"));
		await celebrateWatchCompletion(progress(1));
		expect(mocks.celebrate).toHaveBeenCalledTimes(1);
		mocks.get.mockRejectedValueOnce(new Error("offline"));
		expect(await readCompletionProgress("42")).toBeUndefined();
	});
});

it("uses only valid progress belonging to the current viewer, without fetching", () => {
	const client = new QueryClient();
	const key = [
		{ _id: "showsControllerGetShowProgress", query: { showIds: ["42"] } },
	];
	const query = client.getQueryCache().build(client, {
		queryKey: key,
		queryKeyHashFn: (key) => hashKey([...key, "did:plc:test"]),
	});
	query.setData({ items: [progress(1)] });
	expect(cachedCompletionProgress(client, "42", "did:plc:test")).toEqual(
		progress(1),
	);
	expect(
		cachedCompletionProgress(client, "42", "did:plc:other"),
	).toBeUndefined();
	expect(cachedCompletionProgress(client, "42", undefined)).toBeUndefined();
	query.setData(
		{ items: [progress(1)] },
		{ updatedAt: Date.now() - 30_001, manual: true },
	);
	// Time passing alone must not suppress a celebration on an open page.
	expect(cachedCompletionProgress(client, "42", "did:plc:test")).toEqual(
		progress(1),
	);
	query.setData({ items: [progress(1)] });
	query.invalidate();
	expect(
		cachedCompletionProgress(client, "42", "did:plc:test"),
	).toBeUndefined();
	client.clear();
});

it("makes no confirmation request when confetti is disabled", async () => {
	mocks.get.mockClear();
	mocks.enabled.mockReturnValueOnce(false);
	await celebrateWatchCompletion(progress(1));
	expect(mocks.get).not.toHaveBeenCalled();
});
