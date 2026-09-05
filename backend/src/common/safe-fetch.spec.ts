import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
	BlockedAddressError,
	BlockedUrlError,
	createGuardedLookup,
	createSafeFetch,
	type LookupFn,
	RedirectError,
} from "./safe-fetch";

function lookupResolvingTo(addresses: string[]): LookupFn {
	return (_hostname, _options, callback) => {
		callback(
			null,
			addresses.map((address) => ({
				address,
				family: address.includes(":") ? 6 : 4,
			})),
		);
	};
}

describe("createGuardedLookup", () => {
	function resolve(addresses: string[], options: { all?: boolean } = {}) {
		return new Promise<unknown[]>((resolve, reject) => {
			createGuardedLookup(lookupResolvingTo(addresses))(
				"pds.example.com",
				options,
				(error, ...result) => (error ? reject(error) : resolve(result)),
			);
		});
	}

	it("passes public addresses through in Node's multi-address form", async () => {
		await expect(
			resolve(["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"], {
				all: true,
			}),
		).resolves.toEqual([
			[
				{ address: "93.184.216.34", family: 4 },
				{ address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
			],
		]);
	});

	it("passes the first public address through in Node's single-address form", async () => {
		await expect(resolve(["93.184.216.34", "1.1.1.1"])).resolves.toEqual([
			"93.184.216.34",
			4,
		]);
	});

	it.each([
		["127.0.0.1"],
		["10.0.0.5"],
		["169.254.169.254"],
		["::1"],
		["fd00::1"],
		["::ffff:192.168.1.1"],
	])("rejects the private resolved address %s", async (address) => {
		await expect(resolve([address], { all: true })).rejects.toBeInstanceOf(
			BlockedAddressError,
		);
	});

	it("rejects a mix of public and private addresses", async () => {
		const error = await resolve(["93.184.216.34", "10.0.0.5"], {
			all: true,
		}).catch((error: unknown) => error);

		expect(error).toBeInstanceOf(BlockedAddressError);
		expect((error as BlockedAddressError).address).toBe("10.0.0.5");
		expect((error as BlockedAddressError).hostname).toBe("pds.example.com");
	});

	it("always asks the underlying lookup for every address", async () => {
		const lookup = vi.fn<LookupFn>((_hostname, _options, callback) =>
			callback(null, [{ address: "1.1.1.1", family: 4 }]),
		);

		await new Promise((resolve) =>
			createGuardedLookup(lookup)("pds.example.com", { family: 4 }, resolve),
		);

		expect(lookup).toHaveBeenCalledWith(
			"pds.example.com",
			expect.objectContaining({ all: true, family: 4 }),
			expect.any(Function),
		);
	});

	it("propagates a resolver failure", async () => {
		const failure = Object.assign(new Error("getaddrinfo ENOTFOUND"), {
			code: "ENOTFOUND",
		});
		const lookup: LookupFn = (_hostname, _options, callback) =>
			callback(failure, []);

		await expect(
			new Promise((resolve, reject) =>
				createGuardedLookup(lookup)("nope.example", { all: true }, (error) =>
					error ? reject(error) : resolve(undefined),
				),
			),
		).rejects.toBe(failure);
	});
});

describe("createSafeFetch", () => {
	const fetchMock = vi.fn();
	const lookup = vi.fn<LookupFn>(lookupResolvingTo(["93.184.216.34"]));
	const safeFetch = createSafeFetch({
		lookup,
		fetch: (...args) => fetchMock(...args),
	});

	beforeEach(() => {
		fetchMock.mockReset();
		lookup.mockClear();
	});

	function ok(body = "ok") {
		return new Response(body, { status: 200 });
	}

	function redirect(location: string, status = 302) {
		return new Response(null, { status, headers: { location } });
	}

	it("fetches a public URL with manual redirects through the guarded agent", async () => {
		fetchMock.mockResolvedValue(ok());

		const response = await safeFetch("https://pds.example.com/xrpc/x?did=1");

		expect(response.status).toBe(200);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe(
			"https://pds.example.com/xrpc/x?did=1",
		);
		expect(fetchMock.mock.calls[0][1]).toMatchObject({
			redirect: "manual",
			dispatcher: expect.any(Object),
		});
	});

	it("forwards request options and accepts a URL instance", async () => {
		fetchMock.mockResolvedValue(ok());
		const signal = AbortSignal.timeout(1_000);

		await safeFetch(new URL("https://pds.example.com/"), {
			signal,
			headers: { accept: "application/json" },
		});

		expect(fetchMock.mock.calls[0][1]).toMatchObject({
			signal,
			headers: { accept: "application/json" },
		});
		expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("allowHttp");
		expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("maxRedirects");
	});

	it.each([
		"https://localhost/",
		"https://127.0.0.1/",
		"https://[::1]/",
		"https://backend.railway.internal/",
		"http://pds.example.com/",
		"ftp://pds.example.com/",
	])("rejects %s before fetching or resolving", async (url) => {
		await expect(safeFetch(url)).rejects.toBeInstanceOf(BlockedUrlError);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(lookup).not.toHaveBeenCalled();
	});

	it("allows http only when asked", async () => {
		fetchMock.mockResolvedValue(ok());

		await expect(
			safeFetch("http://pds.test:2583/", { allowHttp: true }),
		).resolves.toMatchObject({ status: 200 });
	});

	it("follows a redirect to another public host", async () => {
		fetchMock
			.mockResolvedValueOnce(redirect("https://cdn.example.net/blob"))
			.mockResolvedValueOnce(ok("blob"));

		const response = await safeFetch("https://pds.example.com/blob");

		expect(await response.text()).toBe("blob");
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[1][0]).toBe("https://cdn.example.net/blob");
		expect(fetchMock.mock.calls[1][1]).toMatchObject({ redirect: "manual" });
	});

	it("resolves a relative Location against the current URL", async () => {
		fetchMock
			.mockResolvedValueOnce(redirect("/moved/here", 301))
			.mockResolvedValueOnce(ok());

		await safeFetch("https://pds.example.com/blob?x=1");

		expect(fetchMock.mock.calls[1][0]).toBe(
			"https://pds.example.com/moved/here",
		);
	});

	it("turns a 303 into a bodiless GET but keeps the method on a 307", async () => {
		fetchMock
			.mockResolvedValueOnce(redirect("https://pds.example.com/a", 307))
			.mockResolvedValueOnce(redirect("https://pds.example.com/b", 303))
			.mockResolvedValueOnce(ok());

		await safeFetch("https://pds.example.com/", {
			method: "POST",
			body: "payload",
		});

		expect(fetchMock.mock.calls[1][1]).toMatchObject({
			method: "POST",
			body: "payload",
		});
		expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "GET" });
		expect(fetchMock.mock.calls[2][1].body).toBeUndefined();
	});

	it.each([
		"http://169.254.169.254/latest/meta-data",
		"https://localhost:2583/",
		"https://[::ffff:10.0.0.1]/",
	])("refuses a redirect to the private target %s", async (location) => {
		fetchMock.mockResolvedValueOnce(redirect(location));

		await expect(safeFetch("https://pds.example.com/")).rejects.toBeInstanceOf(
			BlockedUrlError,
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("refuses a redirect from https to http", async () => {
		fetchMock.mockResolvedValueOnce(redirect("http://pds.example.com/"));

		await expect(safeFetch("https://pds.example.com/")).rejects.toBeInstanceOf(
			BlockedUrlError,
		);
	});

	it("gives up after the default of three redirects", async () => {
		fetchMock.mockResolvedValue(redirect("https://pds.example.com/again"));

		await expect(safeFetch("https://pds.example.com/")).rejects.toBeInstanceOf(
			RedirectError,
		);
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it("honours a custom redirect limit", async () => {
		fetchMock.mockResolvedValue(redirect("https://pds.example.com/again"));

		await expect(
			safeFetch("https://pds.example.com/", { maxRedirects: 0 }),
		).rejects.toBeInstanceOf(RedirectError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("refuses a redirect without a Location header", async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 302 }));

		await expect(safeFetch("https://pds.example.com/")).rejects.toBeInstanceOf(
			RedirectError,
		);
	});

	it("returns non-redirect error responses untouched", async () => {
		fetchMock.mockResolvedValue(new Response("nope", { status: 404 }));

		await expect(safeFetch("https://pds.example.com/")).resolves.toMatchObject({
			status: 404,
		});
	});
});

describe("createSafeFetch with the real transport", () => {
	it("never opens a connection when the hostname resolves to a private address", async () => {
		const server = createServer((_request, response) => response.end("leak"));
		const connections = vi.fn();
		server.on("connection", connections);
		server.listen(0, "127.0.0.1");
		await once(server, "listening");
		const { port } = server.address() as AddressInfo;

		try {
			// A public-looking hostname that "resolves" to loopback, i.e. DNS
			// rebinding pointed at a service on this host.
			const safeFetch = createSafeFetch({
				lookup: lookupResolvingTo(["127.0.0.1"]),
			});

			const error = await safeFetch(`http://pds.example.com:${port}/`, {
				allowHttp: true,
			}).catch((error: unknown) => error);

			expect(error).toBeInstanceOf(Error);
			expect((error as Error & { cause?: unknown }).cause).toBeInstanceOf(
				BlockedAddressError,
			);
			expect(connections).not.toHaveBeenCalled();
		} finally {
			server.close();
		}
	});
});
