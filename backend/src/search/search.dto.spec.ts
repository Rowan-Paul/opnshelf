import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { DiscoverQueryDto } from "./dto/search.dto";

describe("DiscoverQueryDto", () => {
	// The global ValidationPipe whitelists properties, so an undecorated field
	// is rejected as "should not exist". Every discover filter must validate.
	it("accepts page, sortBy and year from query strings", async () => {
		const dto = plainToInstance(DiscoverQueryDto, {
			page: "2",
			sortBy: "vote_average.desc",
			year: "2020",
		});
		expect(await validate(dto, { whitelist: true })).toEqual([]);
		expect(dto.page).toBe(2);
		expect(dto.year).toBe(2020);
	});

	it("rejects an unsupported sort", async () => {
		const dto = plainToInstance(DiscoverQueryDto, { sortBy: "budget.desc" });
		const errors = await validate(dto, { whitelist: true });
		expect(errors.map((e) => e.property)).toEqual(["sortBy"]);
	});

	it("rejects a page below one", async () => {
		const dto = plainToInstance(DiscoverQueryDto, { page: "0" });
		const errors = await validate(dto, { whitelist: true });
		expect(errors.map((e) => e.property)).toEqual(["page"]);
	});
});
