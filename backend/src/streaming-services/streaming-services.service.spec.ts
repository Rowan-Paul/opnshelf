import { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	normalizeCountry,
	StreamingServicesService,
} from "./streaming-services.service";

function jsonResponse(body: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: { get: () => null },
		json: () => Promise.resolve(body),
	};
}

const movieList = {
	results: [
		{
			provider_id: 8,
			provider_name: "Netflix",
			logo_path: "/netflix.jpg",
			display_priority: 5,
			display_priorities: { NL: 0, US: 5 },
		},
		{
			provider_id: 2,
			provider_name: "Apple TV",
			logo_path: "/apple.jpg",
			display_priority: 3,
			display_priorities: { NL: 3 },
		},
	],
};

const tvList = {
	results: [
		{
			provider_id: 8,
			provider_name: "Netflix",
			logo_path: "/netflix.jpg",
			display_priority: 9,
			display_priorities: { NL: 2 },
		},
		{
			provider_id: 337,
			provider_name: "Disney Plus",
			logo_path: null,
			display_priority: 1,
			display_priorities: { NL: 1 },
		},
	],
};

function build() {
	return new StreamingServicesService(
		new ConfigService({ TMDB_API_KEY: "key" }),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("StreamingServicesService.listForCountry", () => {
	it("merges the movie and tv lists, dedupes by id, and orders by the country's priority", async () => {
		const fetchMock = vi.fn((url: string) =>
			Promise.resolve(
				jsonResponse(url.includes("/providers/movie") ? movieList : tvList),
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await build().listForCountry("nl");

		expect(result.country).toBe("NL");
		expect(result.services.map((s) => [s.id, s.displayPriority])).toEqual([
			[8, 0],
			[337, 1],
			[2, 3],
		]);
		expect(result.services[0]).toEqual({
			id: 8,
			name: "Netflix",
			logoUrl: "https://image.tmdb.org/t/p/w92/netflix.jpg",
			displayPriority: 0,
		});
		expect(result.services[1].logoUrl).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(2);
		for (const [url] of fetchMock.mock.calls) {
			expect(url).toContain("watch_region=NL");
		}
	});

	it("throws a TMDB error when either list fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.resolve(jsonResponse({ status_message: "x" }, 500))),
		);

		await expect(build().listForCountry("NL")).rejects.toThrow(
			"Failed to fetch streaming services",
		);
	});
});

describe("normalizeCountry", () => {
	it("uppercases valid codes and falls back to US otherwise", () => {
		expect(normalizeCountry(" gb ")).toBe("GB");
		expect(normalizeCountry("NLD")).toBe("US");
		expect(normalizeCountry("")).toBe("US");
		expect(normalizeCountry(undefined)).toBe("US");
	});
});
