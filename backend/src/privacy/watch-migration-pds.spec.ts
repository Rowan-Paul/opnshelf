import { WATCH_SPACE_SCOPE } from "../auth/oauth-scopes";
import { WatchMigrationPds } from "./watch-migration-pds";
import type { WatchReference } from "./watch-record-migration";
const did = "did:plc:owner";
const ref: WatchReference = {
	collection: "xyz.opnshelf.episode",
	rkey: "episode-watch",
};
const record = {
	cid: "record-cid",
	value: {
		$type: ref.collection,
		showId: "123",
		extension: { preserve: true },
	},
};
const config = {
	readPolicy: { $type: "com.atproto.simplespace.defs#memberListPolicy" },
	writePolicy: { $type: "com.atproto.simplespace.defs#memberListPolicy" },
};
const response = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status });
function fixture() {
	const session = {
		did,
		getTokenInfo: vi.fn(async () => ({ scope: WATCH_SPACE_SCOPE })),
		fetchHandler:
			vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(),
	};
	return { session, repo: new WatchMigrationPds(did, session) };
}

describe("Watch migration PDS transport", () => {
	it("rejects a session belonging to another user", () => {
		const f = fixture();
		expect(() => new WatchMigrationPds("did:plc:other", f.session)).toThrow(
			"owner",
		);
	});
	it("requires the optional Watch grant before any request", async () => {
		const f = fixture();
		f.session.getTokenInfo.mockResolvedValue({ scope: "atproto" });
		await expect(f.repo.assertPrivate()).rejects.toThrow("InsufficientScope");
		expect(f.session.fetchHandler).not.toHaveBeenCalled();
	});
	it("creates an owner-only Space only when it is absent, then rechecks its configuration", async () => {
		const f = fixture();
		f.session.fetchHandler
			.mockResolvedValueOnce(response({ error: "SpaceNotFound" }, 400))
			.mockResolvedValueOnce(response({}))
			.mockResolvedValueOnce(response(config))
			.mockResolvedValueOnce(response({ members: [] }));
		await f.repo.assertPrivate();
		expect(f.session.fetchHandler.mock.calls[1][0]).toBe(
			"/xrpc/com.atproto.simplespace.createSpace",
		);
		expect(
			JSON.parse(String(f.session.fetchHandler.mock.calls[1][1]?.body)),
		).toMatchObject({
			spaceType: "xyz.opnshelf.watches",
			skey: "self",
			...config,
		});
	});
	it.each([
		{
			...config,
			readPolicy: { $type: "com.atproto.simplespace.defs#publicPolicy" },
		},
		{
			...config,
			writePolicy: { $type: "com.atproto.simplespace.defs#publicPolicy" },
		},
	])("refuses a Space with a non-private policy", async (policy) => {
		const f = fixture();
		f.session.fetchHandler.mockResolvedValue(response(policy));
		await expect(f.repo.assertPrivate()).rejects.toThrow("SpaceNotPrivate");
	});
	it.each([
		{ members: [{ did: "did:plc:other" }] },
		{ members: [], cursor: "more" },
		{},
	])(
		"refuses other members or incomplete membership evidence",
		async (members) => {
			const f = fixture();
			f.session.fetchHandler
				.mockResolvedValueOnce(response(config))
				.mockResolvedValueOnce(response(members));
			await expect(f.repo.assertPrivate()).rejects.toThrow("SpaceNotPrivate");
		},
	);
	it("does not mistake a failed PDS for a missing Space", async () => {
		const f = fixture();
		f.session.fetchHandler.mockResolvedValue(
			response({ error: "Unavailable" }, 503),
		);
		await expect(f.repo.assertPrivate()).rejects.toThrow("Unavailable");
		expect(f.session.fetchHandler).toHaveBeenCalledTimes(1);
	});
	it("reads the private record through the authenticated OAuth handler", async () => {
		const f = fixture();
		f.session.fetchHandler.mockResolvedValue(response(record));
		expect(await f.repo.readPrivate(ref)).toEqual(record);
		const [path, init] = f.session.fetchHandler.mock.calls[0];
		const url = new URL(path, "https://pds.example");
		expect(url.pathname).toBe("/xrpc/com.atproto.space.getRecord");
		expect(url.searchParams.get("space")).toBe(
			`at://${did}/space/xyz.opnshelf.watches/self`,
		);
		expect(url.searchParams.get("rkey")).toBe(ref.rkey);
		expect(init?.signal).toBeDefined();
	});
	it("creates rather than overwrites destination records and preserves extensions", async () => {
		const f = fixture();
		f.session.fetchHandler.mockResolvedValue(response({}));
		await f.repo.createPrivate(ref, record);
		const [path, init] = f.session.fetchHandler.mock.calls[0];
		expect(path).toBe("/xrpc/com.atproto.space.createRecord");
		expect(JSON.parse(String(init?.body))).toMatchObject({
			rkey: ref.rkey,
			record: record.value,
		});
	});
	it("uses an atomic CID precondition for public deletion", async () => {
		const f = fixture();
		f.session.fetchHandler.mockResolvedValue(response({}));
		await f.repo.deletePublic(ref, record.cid);
		const [path, init] = f.session.fetchHandler.mock.calls[0];
		expect(path).toBe("/xrpc/com.atproto.repo.deleteRecord");
		expect(JSON.parse(String(init?.body))).toEqual({
			repo: did,
			...ref,
			swapRecord: record.cid,
		});
	});
	it("does not treat a conflicting delete as success", async () => {
		const f = fixture();
		f.session.fetchHandler
			.mockResolvedValueOnce(response({ error: "InvalidSwap" }, 400))
			.mockResolvedValueOnce(response(record));
		await expect(f.repo.deletePublic(ref, record.cid)).rejects.toThrow(
			"A Watch changed",
		);
	});
	it("never falls back to public storage when Spaces is unsupported", async () => {
		const f = fixture();
		f.session.fetchHandler.mockResolvedValue(
			response({ error: "XRPCNotSupported" }, 501),
		);
		await expect(f.repo.createPrivate(ref, record)).rejects.toThrow(
			"XRPCNotSupported",
		);
		expect(f.session.fetchHandler).toHaveBeenCalledTimes(2);
		for (const [path] of f.session.fetchHandler.mock.calls)
			expect(path).toContain("/xrpc/com.atproto.space.");
	});
	it.each([
		{ value: record.value },
		{ ...record, value: { $type: "xyz.opnshelf.note" } },
		[],
	])("rejects malformed record responses", async (body) => {
		const f = fixture();
		f.session.fetchHandler.mockResolvedValue(response(body));
		await expect(f.repo.readPublic(ref)).rejects.toThrow();
	});
	it("bounds untrusted PDS responses", async () => {
		const f = fixture();
		f.session.fetchHandler.mockResolvedValue(
			new Response("x".repeat(2 * 1024 * 1024 + 1)),
		);
		await expect(f.repo.readPrivate(ref)).rejects.toThrow("ResponseTooLarge");
	});
	it("does not expose a PDS error body as a diagnostic", async () => {
		const f = fixture();
		f.session.fetchHandler.mockResolvedValue(
			response({ error: "private watch content here" }, 500),
		);
		await expect(f.repo.readPrivate(ref)).rejects.toThrow("UnknownError");
	});
	it("retries a destination-create race by letting the mover verify the existing CID", async () => {
		const f = fixture();
		f.session.fetchHandler
			.mockResolvedValueOnce(response({ error: "RecordAlreadyExists" }, 400))
			.mockResolvedValueOnce(response(record));
		await expect(f.repo.createPrivate(ref, record)).resolves.toBeUndefined();
	});
});

it("recognizes a concurrently removed public source without unconditional deletion", async () => {
	const f = fixture();
	f.session.fetchHandler
		.mockResolvedValueOnce(response({ error: "InvalidSwap" }, 400))
		.mockResolvedValueOnce(response({ error: "RecordNotFound" }, 400));
	await expect(f.repo.deletePublic(ref, record.cid)).resolves.toBeUndefined();
	expect(f.session.fetchHandler).toHaveBeenCalledTimes(2);
});

describe("conditional private Watch deletion", () => {
	const capabilities = {
		tranquilSpaceCapabilities: ["deleteRecord.swapRecord.v1"],
	};
	it.each([
		{},
		{ tranquilSpaceCapabilities: [] },
		{ tranquilSpaceCapabilities: "deleteRecord.swapRecord.v1" },
	])(
		"refuses unsupported PDSs without sending a delete",
		async (description) => {
			const f = fixture();
			f.session.fetchHandler.mockResolvedValue(response(description));
			await expect(f.repo.deletePrivate(ref, record.cid)).rejects.toThrow(
				"ConditionalDeleteUnsupported",
			);
			expect(f.session.fetchHandler).toHaveBeenCalledTimes(1);
		},
	);
	it("uses the original CID and private Space on deletion", async () => {
		const f = fixture();
		f.session.fetchHandler
			.mockResolvedValueOnce(response(capabilities))
			.mockResolvedValueOnce(response({}));
		await f.repo.deletePrivate(ref, record.cid);
		expect(f.session.fetchHandler.mock.calls[1][0]).toBe(
			"/xrpc/com.atproto.space.deleteRecord",
		);
		expect(
			JSON.parse(String(f.session.fetchHandler.mock.calls[1][1]?.body)),
		).toEqual({
			...ref,
			repo: did,
			space: f.repo.space,
			swapRecord: record.cid,
		});
	});
	it("preserves a concurrent edit and never retries unconditionally", async () => {
		const f = fixture();
		f.session.fetchHandler
			.mockResolvedValueOnce(response(capabilities))
			.mockResolvedValueOnce(response({ error: "InvalidSwap" }, 400))
			.mockResolvedValueOnce(response({ ...record, cid: "edited" }));
		await expect(f.repo.deletePrivate(ref, record.cid)).rejects.toThrow(
			"changed",
		);
		expect(f.session.fetchHandler).toHaveBeenCalledTimes(3);
		expect(f.session.fetchHandler.mock.calls[2][0]).toContain(
			"com.atproto.space.getRecord",
		);
	});
	it("accepts a concurrent deletion only after checking absence", async () => {
		const f = fixture();
		f.session.fetchHandler
			.mockResolvedValueOnce(response(capabilities))
			.mockResolvedValueOnce(response({ error: "InvalidSwap" }, 400))
			.mockResolvedValueOnce(response({ error: "RecordNotFound" }, 400));
		await expect(
			f.repo.deletePrivate(ref, record.cid),
		).resolves.toBeUndefined();
	});
	it("creates a public copy without replacing an existing record", async () => {
		const f = fixture();
		f.session.fetchHandler.mockResolvedValue(response({}));
		await f.repo.createPublic(ref, record);
		expect(f.session.fetchHandler.mock.calls[0][0]).toBe(
			"/xrpc/com.atproto.repo.createRecord",
		);
		expect(
			JSON.parse(String(f.session.fetchHandler.mock.calls[0][1]?.body)),
		).toEqual({
			...ref,
			repo: did,
			record: record.value,
			validate: false,
		});
	});
});

describe("destination create recovery", () => {
	it.each(["InvalidRequest", "RecordAlreadyExists"])(
		"verifies a public destination after %s",
		async (error) => {
			const f = fixture();
			f.session.fetchHandler
				.mockResolvedValueOnce(response({ error }, 400))
				.mockResolvedValueOnce(response(record));
			await expect(f.repo.createPublic(ref, record)).resolves.toBeUndefined();
			expect(f.session.fetchHandler.mock.calls[1][0]).toContain(
				"com.atproto.repo.getRecord",
			);
		},
	);
	it("recovers a create whose success response was lost", async () => {
		const f = fixture();
		f.session.fetchHandler
			.mockRejectedValueOnce(new Error("timeout"))
			.mockResolvedValueOnce(response(record));
		await expect(f.repo.createPublic(ref, record)).resolves.toBeUndefined();
	});
	it("does not swallow unrelated InvalidRequest errors", async () => {
		const f = fixture();
		f.session.fetchHandler
			.mockResolvedValueOnce(response({ error: "InvalidRequest" }, 400))
			.mockResolvedValueOnce(response({ error: "RecordNotFound" }, 400));
		await expect(f.repo.createPublic(ref, record)).rejects.toThrow(
			"InvalidRequest",
		);
	});
	it("refuses a different destination without overwriting it", async () => {
		const f = fixture();
		f.session.fetchHandler
			.mockResolvedValueOnce(response({ error: "InvalidRequest" }, 400))
			.mockResolvedValueOnce(response({ ...record, cid: "changed" }));
		await expect(f.repo.createPublic(ref, record)).rejects.toThrow("changed");
		expect(f.session.fetchHandler).toHaveBeenCalledTimes(2);
	});
});

it.each(["SpaceNotFound", "SpaceDeleted"])(
	"reverse validation never creates a Space after %s",
	async (error) => {
		const f = fixture();
		f.session.fetchHandler.mockResolvedValue(response({ error }, 400));
		await expect(f.repo.assertExistingPrivate()).rejects.toThrow(error);
		expect(f.session.fetchHandler).toHaveBeenCalledTimes(1);
		expect(f.session.fetchHandler.mock.calls[0][1]?.method).toBe("GET");
	},
);

it("stops before sending a PDS request when the account lock is lost", async () => {
	const f = fixture();
	const controller = new AbortController();
	controller.abort(new Error("account lock lost"));
	const repo = new WatchMigrationPds(did, f.session, controller.signal);
	await expect(repo.createPublic(ref, record)).rejects.toThrow(
		"account lock lost",
	);
	expect(f.session.fetchHandler).not.toHaveBeenCalled();
});
