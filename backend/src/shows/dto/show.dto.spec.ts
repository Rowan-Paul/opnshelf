import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
	MAX_SHOW_PROGRESS_IDS,
	PaginatedUpNextQueryDto,
	ShowProgressQueryDto,
} from "./show.dto";

describe("ShowProgressQueryDto", () => {
	// `?showIds=1399` arrives as a string, `?showIds=1399&showIds=1396` as an
	// array. A single visible show is the common case, so it must still parse.
	it("widens a single query value into a one-element array", async () => {
		const dto = plainToInstance(ShowProgressQueryDto, { showIds: "1399" });

		expect(dto.showIds).toEqual(["1399"]);
		await expect(validate(dto)).resolves.toHaveLength(0);
	});

	it("keeps a repeated query value as the array it arrived as", async () => {
		const dto = plainToInstance(ShowProgressQueryDto, {
			showIds: ["1399", "1396"],
		});

		expect(dto.showIds).toEqual(["1399", "1396"]);
		await expect(validate(dto)).resolves.toHaveLength(0);
	});

	it.each([
		["a missing parameter", undefined],
		["a non-numeric ID", ["not-a-show"]],
		[
			"more than the batch limit",
			Array.from({ length: MAX_SHOW_PROGRESS_IDS + 1 }, (_, i) => `${i}`),
		],
	])("rejects %s", async (_case, showIds) => {
		const errors = await validate(
			plainToInstance(ShowProgressQueryDto, { showIds }),
		);

		expect(errors.some((error) => error.property === "showIds")).toBe(true);
	});
});

describe("PaginatedUpNextQueryDto services", () => {
	it.each([undefined, "mine", "8", "8,350"])("accepts %s", async (services) => {
		await expect(
			validate(plainToInstance(PaginatedUpNextQueryDto, { services })),
		).resolves.toHaveLength(0);
	});
	it.each([
		"all",
		"",
		"0",
		"-8",
		"8,",
		"mine,8",
		"8.5",
		"1234567890",
		Array(51).fill("8").join(","),
		["mine"],
	])("rejects unsupported filter %s", async (services) => {
		const errors = await validate(
			plainToInstance(PaginatedUpNextQueryDto, { services }),
		);
		expect(errors.some((error) => error.property === "services")).toBe(true);
	});
});
