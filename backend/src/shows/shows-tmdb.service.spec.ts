import { ConfigService } from "@nestjs/config";
import { ShowsTmdbService } from "./shows-tmdb.service";

const offer = {
	provider_id: 8,
	provider_name: "Netflix",
	logo_path: "",
	display_priority: 1,
};

describe("Up Next season availability", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("falls back only when season data is absent, and reuses cached reads", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ id: 1, results: {} }))
			.mockResolvedValueOnce(
				Response.json({
					id: 1,
					results: { NL: { link: "", flatrate: [offer] } },
				}),
			)
			.mockResolvedValueOnce(
				Response.json({ id: 2, results: { NL: { link: "", buy: [offer] } } }),
			);
		vi.stubGlobal("fetch", fetch);
		const service = new ShowsTmdbService(
			new ConfigService({ TMDB_API_KEY: "test" }),
		);
		expect(
			(await service.getUpNextAvailability("1", 2)).results.NL.flatrate,
		).toEqual([offer]);
		await service.getUpNextAvailability("1", 2);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(fetch.mock.calls[0][0]).toContain("/tv/1/season/2/watch/providers?");
		expect(fetch.mock.calls[1][0]).toContain("/tv/1/watch/providers?");
		expect(
			(await service.getUpNextAvailability("1", 3)).results.NL.flatrate,
		).toBeUndefined();
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it("falls back on a missing season but does not treat upstream errors as missing data", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(null, { status: 404 }))
			.mockResolvedValueOnce(Response.json({ id: 1, results: {} }))
			.mockResolvedValueOnce(new Response(null, { status: 403 }));
		vi.stubGlobal("fetch", fetch);
		const service = new ShowsTmdbService(
			new ConfigService({ TMDB_API_KEY: "test" }),
		);
		await expect(service.getUpNextAvailability("1", 2)).resolves.toEqual({
			id: 1,
			results: {},
		});
		await expect(service.getUpNextAvailability("1", 3)).rejects.toThrow(
			"Failed to fetch season availability",
		);
		expect(fetch).toHaveBeenCalledTimes(3);
	});
});
