import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { BatchRatingQueryDto, MAX_BATCH_RATING_IDS } from "./rating.dto";

describe("BatchRatingQueryDto", () => {
	const validateDto = (input: Partial<BatchRatingQueryDto>) =>
		validate(Object.assign(new BatchRatingQueryDto(), input));

	// Express hands `?mediaIds=550` back as a string and `?mediaIds=550&mediaIds=680`
	// as an array, so a one-poster page must not read as a malformed batch.
	it("widens a single query value into a one-element array", async () => {
		const dto = plainToInstance(BatchRatingQueryDto, {
			mediaType: "movie",
			mediaIds: "550",
		});

		expect(dto.mediaIds).toEqual(["550"]);
		await expect(validate(dto)).resolves.toHaveLength(0);
	});

	it("keeps a repeated query value as the array it arrived as", async () => {
		const dto = plainToInstance(BatchRatingQueryDto, {
			mediaType: "movie",
			mediaIds: ["550", "680"],
		});

		expect(dto.mediaIds).toEqual(["550", "680"]);
		await expect(validate(dto)).resolves.toHaveLength(0);
	});

	it("rejects a missing mediaIds parameter", async () => {
		const errors = await validate(
			plainToInstance(BatchRatingQueryDto, { mediaType: "movie" }),
		);

		expect(errors.some((error) => error.property === "mediaIds")).toBe(true);
	});

	it("accepts a valid batch request", async () => {
		await expect(
			validateDto({ mediaType: "movie", mediaIds: ["123", "456"] }),
		).resolves.toHaveLength(0);
	});

	it.each([
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
