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
			{
				listForCountry: vi.fn().mockResolvedValue({
					services: [
						{ id: 8, name: "Netflix" },
						{ id: 337, name: "Disney+" },
					],
				}),
			} as never,
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
			{
				listForCountry: vi.fn().mockResolvedValue({
					services: [
						{ id: 8, name: "Netflix" },
						{ id: 337, name: "Disney+" },
					],
				}),
			} as never,
			{ get: vi.fn(() => "test-api-key") } as unknown as ConfigService,
		);
		const second = await service.onboarding();

		expect(first.items).toHaveLength(20);
		expect(first.items.filter((item) => item.id < 200)).toHaveLength(14);
		expect(first.items.filter((item) => item.id >= 200)).toHaveLength(6);
		expect(first.items.map((item) => `${item.media_type}:${item.id}`)).toEqual(
			second.items.map((item) => `${item.media_type}:${item.id}`),
		);
		expect(
			new Set(first.items.map((item) => `${item.media_type}:${item.id}`)).size,
		).toBe(20);
		for (let index = 1; index < first.items.length; index++) {
			expect(first.items[index].media_type).not.toBe(
				first.items[index - 1].media_type,
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

		expect(result.items).toHaveLength(20);
		expect(result.items.every((item) => Boolean(item.poster_path))).toBe(true);
	});

	it("throws when every TMDB source fails", async () => {
		mockFetch.mockResolvedValue(response([], false, 404));

		await expect(service.onboarding()).rejects.toBeInstanceOf(
			TmdbNotFoundError,
		);
	});
});

describe("DiscoverService popular on your services", () => {
	const findUnique = vi.fn();
	let service: DiscoverService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new DiscoverService(
			{ user: { findUnique } } as never,
			{} as never,
			{} as never,
			{
				listForCountry: vi.fn().mockResolvedValue({
					services: [
						{ id: 8, name: "Netflix" },
						{ id: 337, name: "Disney+" },
					],
				}),
			} as never,
			{ get: vi.fn(() => "test-api-key") } as unknown as ConfigService,
		);
	});

	it.each([null, { watchCountry: "NL", streamingServiceIds: [] }])(
		"does not request unfiltered titles when preferences are absent: %s",
		async (user) => {
			findUnique.mockResolvedValue(user);
			expect(await service.popularOnYourServices("did:plc:viewer")).toEqual({
				rows: [],
			});
			expect(mockFetch).not.toHaveBeenCalled();
		},
	);

	it("filters both media types by country and each saved flat-rate service, then caps each mixed row", async () => {
		findUnique.mockResolvedValue({
			watchCountry: "nl",
			streamingServiceIds: [337, 8, 8],
		});
		mockFetch.mockImplementation((url: string) =>
			Promise.resolve(
				response(
					Array.from({ length: 20 }, (_, i) =>
						url.includes("/movie?") ? movie(i + 1) : show(i + 1),
					),
				),
			),
		);
		const result = await service.popularOnYourServices("did:plc:viewer");
		expect(findUnique).toHaveBeenCalledWith({
			where: { did: "did:plc:viewer" },
			select: { watchCountry: true, streamingServiceIds: true },
		});
		expect(mockFetch).toHaveBeenCalledTimes(4);
		for (const [url] of mockFetch.mock.calls) {
			const params = new URL(url).searchParams;
			expect(params.get("watch_region")).toBe("NL");
			expect(["8", "337"]).toContain(params.get("with_watch_providers"));
			expect(params.get("with_watch_monetization_types")).toBe("flatrate");
			expect(params.get("sort_by")).toBe("popularity.desc");
		}
		expect(result.rows.map((row) => row.serviceName)).toEqual([
			"Netflix",
			"Disney+",
		]);
		expect(result.rows.every((row) => row.items.length === 20)).toBe(true);
		expect(
			result.rows[0].items
				.slice(0, 4)
				.map((item) => `${item.media_type}:${item.id}`),
		).toEqual(["movie:1", "tv:1", "movie:2", "tv:2"]);
	});

	it("hides services absent from the country's catalogue", async () => {
		findUnique.mockResolvedValue({
			watchCountry: "NL",
			streamingServiceIds: [999],
		});
		expect(await service.popularOnYourServices("did:plc:viewer")).toEqual({
			rows: [],
		});
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("uses a separate cached request after the country or services change", async () => {
		mockFetch.mockResolvedValue(response([]));
		for (const preferences of [
			{ watchCountry: "NL", streamingServiceIds: [8] },
			{ watchCountry: "US", streamingServiceIds: [8] },
			{ watchCountry: "US", streamingServiceIds: [337] },
		]) {
			findUnique.mockResolvedValue(preferences);
			await service.popularOnYourServices("did:plc:viewer");
		}
		expect(mockFetch).toHaveBeenCalledTimes(6);
	});

	it("returns an empty row when the saved services have no titles in the country", async () => {
		findUnique.mockResolvedValue({
			watchCountry: "NL",
			streamingServiceIds: [8],
		});
		mockFetch.mockResolvedValue(response([]));
		expect(await service.popularOnYourServices("did:plc:viewer")).toEqual({
			rows: [],
		});
	});

	it("surfaces TMDB errors instead of falling back to unfiltered popularity", async () => {
		findUnique.mockResolvedValue({
			watchCountry: "NL",
			streamingServiceIds: [8],
		});
		mockFetch.mockResolvedValue(response([], false, 404));
		await expect(
			service.popularOnYourServices("did:plc:viewer"),
		).rejects.toBeInstanceOf(TmdbNotFoundError);
	});
});
