import { validate } from "class-validator";
import { BatchRatingRequestDto, MAX_BATCH_RATING_IDS } from "./rating.dto";

describe("BatchRatingRequestDto", () => {
	const validateDto = (input: Partial<BatchRatingRequestDto>) =>
		validate(Object.assign(new BatchRatingRequestDto(), input));

	it("accepts a valid batch request", async () => {
		await expect(
			validateDto({ mediaType: "movie", mediaIds: ["123", "456"] }),
		).resolves.toHaveLength(0);
	});

	it.each([
		["a non-array", "123"],
		["an empty array", []],
		[
			"more than the batch limit",
			Array.from({ length: MAX_BATCH_RATING_IDS + 1 }, (_, index) =>
				String(index),
			),
		],
		["duplicate IDs", ["123", "123"]],
	])("rejects %s", async (_case, mediaIds) => {
		const errors = await validateDto({
			mediaType: "movie",
			mediaIds: mediaIds as string[],
		});

		expect(errors.some((error) => error.property === "mediaIds")).toBe(true);
	});

	it("rejects an unsupported media type", async () => {
		const errors = await validateDto({
			mediaType: "episode" as "movie",
			mediaIds: ["123"],
		});

		expect(errors.some((error) => error.property === "mediaType")).toBe(true);
	});

	it.each([
		["an empty ID", ""],
		["an oversized ID", "1".repeat(51)],
	])("rejects %s", async (_case, mediaId) => {
		const errors = await validateDto({
			mediaType: "show",
			mediaIds: [mediaId],
		});

		expect(errors.some((error) => error.property === "mediaIds")).toBe(true);
	});
});
