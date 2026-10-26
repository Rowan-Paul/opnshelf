import type { ShowProgressDto } from "@opnshelf/api";
import { describe, expect, it, vi } from "vitest";
import {
	celebrateWatchCompletion,
	newlyCompleted,
	readCompletionProgress,
} from "./watch-completion";

const mocks = vi.hoisted(() => ({ get: vi.fn(), celebrate: vi.fn() }));
vi.mock("@opnshelf/api", () => ({ showsControllerGetShowProgress: mocks.get }));
vi.mock("#/components/completion-confetti", () => ({
	celebrateCompletion: mocks.celebrate,
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
