// @vitest-environment node
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openGraphImageResponse } from "./open-graph-image.server";

vi.mock("./release-notes.server", () => ({
	publishedReleaseNotes: () => [
		{
			slug: "public-update",
			title: "A new update",
			summary: "More ways to watch.",
		},
	],
}));
afterEach(() => vi.unstubAllGlobals());

describe("Open Graph image endpoint", () => {
	it("serves a landscape fallback without authentication or network requests", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		const response = await openGraphImageResponse(
			new Request("https://opnshelf.xyz/api/og"),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(
			await sharp(Buffer.from(await response.arrayBuffer())).metadata(),
		).toMatchObject({ width: 1200, height: 630, format: "png" });
		expect(fetch).not.toHaveBeenCalled();
	});

	it("composes the first eight public List items, never forwards cookies, and skips unsafe poster paths", async () => {
		const poster = await sharp({
			create: { width: 146, height: 219, channels: 3, background: "#ff0000" },
		})
			.png()
			.toBuffer();
		const fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = new URL(input);
			expect(new Headers(init?.headers).has("cookie")).toBe(false);
			if (url.pathname.endsWith("/profile")) {
				expect(init?.credentials).toBe("omit");
				return Response.json({
					did: "did:plc:test",
					handle: "test.example",
					displayName: "Owner <script>",
				});
			}
			if (url.pathname.startsWith("/lists/user/")) {
				expect(url.searchParams.get("sort")).toBe("position");
				expect(url.searchParams.get("pageSize")).toBe("8");
				return Response.json({
					name: "Favorites & <friends>",
					total: 9,
					items: Array.from({ length: 9 }, (_, i) => ({
						media: {
							title: "Movie",
							posterPath:
								i === 7 ? "https://private.example/secret" : "/poster.jpg",
						},
					})),
				});
			}
			expect(url.origin).toBe("https://image.tmdb.org");
			return new Response(new Uint8Array(poster));
		});
		vi.stubGlobal("fetch", fetch);
		const response = await openGraphImageResponse(
			new Request(
				"https://opnshelf.xyz/api/og?handle=test.example&list=favorites",
				{ headers: { cookie: "session=must-not-forward" } },
			),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		const image = sharp(Buffer.from(await response.arrayBuffer()));
		const { data, info } = await image
			.raw()
			.toBuffer({ resolveWithObject: true });
		// Both rows contain actual poster pixels, rather than only the first poster.
		for (const [x, y] of [
			[550, 100],
			[550, 340],
			[865, 340],
		]) {
			const pixel = (y * info.width + x) * info.channels;
			expect([...data.subarray(pixel, pixel + 3)]).toEqual([255, 0, 0]);
		}
		expect(fetch).toHaveBeenCalledTimes(9);
	});

	it("returns no private data or cached image when the anonymous List request is denied", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(Response.json({ did: "did:plc:test" }))
				.mockResolvedValueOnce(new Response(null, { status: 404 })),
		);
		const response = await openGraphImageResponse(
			new Request(
				"https://opnshelf.xyz/api/og?handle=test.example&list=private",
			),
		);
		expect(response.status).toBe(404);
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	it("distinguishes an API outage from a private or missing List", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
		const response = await openGraphImageResponse(
			new Request(
				"https://opnshelf.xyz/api/og?handle=test.example&list=favorites",
			),
		);
		expect(response.status).toBe(503);
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	it("does not request private Shelf content for a profile image, even with a session cookie", async () => {
		const fetch = vi.fn().mockResolvedValue(
			Response.json({
				did: "did:plc:test",
				handle: "test.example",
				watchesPublic: false,
			}),
		);
		vi.stubGlobal("fetch", fetch);
		const response = await openGraphImageResponse(
			new Request(
				"https://opnshelf.xyz/api/og?handle=test.example&view=shelf",
				{ headers: { cookie: "session=private" } },
			),
		);
		expect(response.status).toBe(200);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch.mock.calls[0][1].credentials).toBe("omit");
	});

	it("fetches only the anonymous public Shelf for profile grids", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({
					did: "did:plc:test",
					handle: "test.example",
					watchesPublic: true,
				}),
			)
			.mockResolvedValueOnce(
				Response.json({ items: [{ type: "movie", title: "Public movie" }] }),
			);
		vi.stubGlobal("fetch", fetch);
		const response = await openGraphImageResponse(
			new Request(
				"https://opnshelf.xyz/api/og?handle=test.example&view=profile",
			),
		);
		expect(response.status).toBe(200);
		expect(String(fetch.mock.calls[1][0])).toContain(
			"/users/did%3Aplc%3Atest/shelf?",
		);
		expect(
			fetch.mock.calls.every((call) => call[1].credentials === "omit"),
		).toBe(true);
	});

	it("renders public Reviews without using the body or spoiler excerpt", async () => {
		const review = {
			reviewTitle: "A great film",
			author: { handle: "test.example" },
			get markdown() {
				throw new Error("Do not read body");
			},
			get description() {
				throw new Error("Do not read excerpt");
			},
		};
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: true, json: async () => review }),
		);
		expect(
			(
				await openGraphImageResponse(
					new Request(
						"https://opnshelf.xyz/api/og?handle=test.example&review=abc",
					),
				)
			).status,
		).toBe(200);
	});

	it("renders only published Release Notes", async () => {
		expect(
			(
				await openGraphImageResponse(
					new Request("https://opnshelf.xyz/api/og?release=public-update"),
				)
			).status,
		).toBe(200);
		expect(
			(
				await openGraphImageResponse(
					new Request("https://opnshelf.xyz/api/og?release=draft"),
				)
			).status,
		).toBe(404);
	});

	it("preserves the top and bottom of portrait artwork inside the landscape card", async () => {
		const strip = async (color: string) =>
			sharp({
				create: { width: 10, height: 1, channels: 3, background: color },
			})
				.png()
				.toBuffer();
		const poster = await sharp({
			create: { width: 10, height: 20, channels: 3, background: "#ff0000" },
		})
			.composite([
				{ input: await strip("#00ff00"), left: 0, top: 0 },
				{ input: await strip("#0000ff"), left: 0, top: 19 },
			])
			.png()
			.toBuffer();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(new Uint8Array(poster))),
		);
		const response = await openGraphImageResponse(
			new Request(
				"https://opnshelf.xyz/api/og?title=Movie&poster=%2Fposter.jpg",
			),
		);
		const { data, info } = await sharp(
			Buffer.from(await response.arrayBuffer()),
		)
			.raw()
			.toBuffer({ resolveWithObject: true });
		const top = (100 * info.width + 950) * info.channels;
		const bottom = (535 * info.width + 950) * info.channels;
		expect([...data.subarray(top, top + 3)]).toEqual([0, 255, 0]);
		expect([...data.subarray(bottom, bottom + 3)]).toEqual([0, 0, 255]);
	});

	it("rejects arbitrary image URLs instead of fetching them", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		expect(
			(
				await openGraphImageResponse(
					new Request(
						"https://opnshelf.xyz/api/og?title=Test&poster=https://private.example/secret",
					),
				)
			).status,
		).toBe(400);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("renders a fallback tile when a poster download fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(
					Response.json({ did: "did:plc:test", handle: "test.example" }),
				)
				.mockResolvedValueOnce(
					Response.json({
						name: "List",
						total: 1,
						items: [
							{
								media: {
									title: "Unavailable poster",
									posterPath: "/poster.jpg",
								},
							},
						],
					}),
				)
				.mockRejectedValueOnce(new Error("timeout")),
		);
		const response = await openGraphImageResponse(
			new Request(
				"https://opnshelf.xyz/api/og?handle=test.example&list=favorites",
			),
		);
		expect(response.status).toBe(200);
		expect(
			await sharp(Buffer.from(await response.arrayBuffer())).metadata(),
		).toMatchObject({ width: 1200, height: 630 });
	});
});
