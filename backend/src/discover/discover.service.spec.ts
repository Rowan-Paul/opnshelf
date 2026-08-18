import { ConfigService } from "@nestjs/config";
import { TmdbNotFoundError } from "../tmdb/tmdb-http";
import { DiscoverService } from "./discover.service";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const response = (results: unknown[], ok = true, status = 200) => ({
	ok,
	status,
	json: vi.fn().mockResolvedValue({ results }),
});

const movie = (id: number, overrides: Record<string, unknown> = {}) => ({
	id,
	title: `Movie ${id}`,
	poster_path: `/movie-${id}.jpg`,
	...overrides,
});

const show = (id: number, overrides: Record<string, unknown> = {}) => ({
	id,
	name: `Show ${id}`,
	poster_path: `/show-${id}.jpg`,
	...overrides,
});

describe("DiscoverService onboarding", () => {
	let service: DiscoverService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new DiscoverService(
			{} as never,
			{} as never,
			{} as never,
			{ get: vi.fn(() => "test-api-key") } as unknown as ConfigService,
		);
	});

	it("returns a deterministic 70/30 deck with alternating media types", async () => {
		const movies = Array.from({ length: 20 }, (_, index) => movie(index + 1));
		const shows = Array.from({ length: 20 }, (_, index) => show(index + 101));
		const trending = [
			{ ...movie(1), media_type: "movie" },
			{ ...movie(0), media_type: "movie" },
			{ ...show(999, { poster_path: undefined }), media_type: "tv" },
			...Array.from({ length: 10 }, (_, index) =>
				index % 2 === 0
					? { ...movie(index + 201), media_type: "movie" }
					: { ...show(index + 201), media_type: "tv" },
			),
		];
		mockFetch.mockImplementation((url: string) => {
			if (url.includes("discover/movie"))
				return Promise.resolve(response(movies));
			if (url.includes("discover/tv")) return Promise.resolve(response(shows));
			return Promise.resolve(response(trending));
		});

		const first = await service.onboarding();
		service = new DiscoverService(
			{} as never,
			{} as never,
			{} as never,
			{ get: vi.fn(() => "test-api-key") } as unknown as ConfigService,
		);
		const second = await service.onboarding();

		expect(first.results).toHaveLength(20);
		expect(first.results.filter((item) => item.id < 200)).toHaveLength(14);
		expect(first.results.filter((item) => item.id >= 200)).toHaveLength(6);
		expect(
			first.results.map((item) => `${item.media_type}:${item.id}`),
		).toEqual(second.results.map((item) => `${item.media_type}:${item.id}`));
		expect(
			new Set(first.results.map((item) => `${item.media_type}:${item.id}`))
				.size,
		).toBe(20);
		for (let index = 1; index < first.results.length; index++) {
			expect(first.results[index].media_type).not.toBe(
				first.results[index - 1].media_type,
			);
		}
		expect(
			mockFetch.mock.calls.some(([url]) =>
				String(url).includes("sort_by=vote_count.desc"),
			),
		).toBe(true);
	});

	it("backfills to 20 and keeps valid results when one source fails", async () => {
		mockFetch.mockImplementation((url: string) => {
			if (url.includes("discover/tv")) {
				return Promise.resolve(response([], false, 404));
			}
			if (url.includes("discover/movie")) {
				return Promise.resolve(
					response(Array.from({ length: 20 }, (_, index) => movie(index + 1))),
				);
			}
			return Promise.resolve(
				response(
					Array.from({ length: 20 }, (_, index) => ({
						...show(index + 101),
						media_type: "tv",
					})),
				),
			);
		});

		const result = await service.onboarding();

		expect(result.results).toHaveLength(20);
		expect(result.results.every((item) => Boolean(item.poster_path))).toBe(
			true,
		);
	});

	it("throws when every TMDB source fails", async () => {
		mockFetch.mockResolvedValue(response([], false, 404));

		await expect(service.onboarding()).rejects.toBeInstanceOf(
			TmdbNotFoundError,
		);
	});
});
