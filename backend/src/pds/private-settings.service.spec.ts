import { BadGatewayException, ForbiddenException } from "@nestjs/common";
import { mockEnvironment } from "../../test/env";
import { PRIVATE_SETTINGS_SCOPE } from "../auth/oauth-scopes";
import { PrivateSettingsService } from "./private-settings.service";

const did = "did:plc:owner";
const privatePolicy = {
	$type: "com.atproto.simplespace.defs#memberListPolicy",
};
const config = { readPolicy: privatePolicy, writePolicy: privatePolicy };
const value = { $type: "xyz.opnshelf.privateSettings", timeFormat: "24h" };
const response = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status });
function fixture(enabled = true) {
	const session = {
		did,
		getTokenInfo: vi.fn().mockResolvedValue({ scope: PRIVATE_SETTINGS_SCOPE }),
		fetchHandler: vi.fn(),
	};
	const service = new PrivateSettingsService(
		mockEnvironment({ ENABLE_ATPROTO_SPACES: enabled }),
	);
	return { session, service };
}

describe("Private Settings", () => {
	it("does not touch the PDS when the experiment is disabled", async () => {
		const { service, session } = fixture(false);
		expect(await service.read(did, false, session)).toEqual({
			enabled: false,
			status: "disabled",
		});
		expect(session.fetchHandler).not.toHaveBeenCalled();
		await expect(service.save(did, session, "12h")).rejects.toThrow("disabled");
	});
	it("probes without writes or private data reads before consent", async () => {
		const { service, session } = fixture();
		session.fetchHandler.mockResolvedValue(response({ spaces: [] }));
		expect(await service.read(did, false, session)).toEqual({
			enabled: false,
			status: "available",
		});
		expect(session.fetchHandler).toHaveBeenCalledWith(
			"/xrpc/com.atproto.space.listSpaces?limit=1",
			expect.objectContaining({ method: "GET" }),
		);
	});
	it.each([
		[501, "NotImplemented", "unsupported"],
		[400, "SpaceDeleted", "missing"],
		[400, "RecordNotFound", "missing"],
		[403, "InsufficientScope", "permissionRequired"],
		[503, "Unavailable", "unavailable"],
	])(
		"reports HTTP %s %s without inventing a private value",
		async (status, error, expected) => {
			const { service, session } = fixture();
			session.fetchHandler.mockResolvedValue(response({ error }, status));
			expect(await service.read(did, true, session)).toEqual({
				enabled: true,
				status: expected,
			});
		},
	);
	it("reads the real record on every request", async () => {
		const { service, session } = fixture();
		session.fetchHandler
			.mockResolvedValueOnce(response({ value }))
			.mockResolvedValueOnce(
				response({ value: { ...value, timeFormat: "12h" } }),
			);
		expect((await service.read(did, true, session)).timeFormat).toBe("24h");
		expect((await service.read(did, true, session)).timeFormat).toBe("12h");
	});
	it("rejects malformed stored values", async () => {
		const { service, session } = fixture();
		session.fetchHandler.mockResolvedValue(
			response({ value: { ...value, timeFormat: "wrong" } }),
		);
		expect((await service.read(did, true, session)).status).toBe("unavailable");
	});
	it("requires the owner and full grant before writing", async () => {
		const { service, session } = fixture();
		await expect(
			service.save("did:plc:other", session, "24h"),
		).rejects.toBeInstanceOf(ForbiddenException);
		session.getTokenInfo.mockResolvedValue({ scope: "atproto" });
		await expect(service.save(did, session, "24h")).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		expect(session.fetchHandler).not.toHaveBeenCalled();
	});
	it("creates only an owner-controlled Space and writes via the private API", async () => {
		const { service, session } = fixture();
		session.fetchHandler
			.mockResolvedValueOnce(response({ error: "SpaceNotFound" }, 400))
			.mockResolvedValueOnce(response({}))
			.mockResolvedValueOnce(response(config))
			.mockResolvedValueOnce(response({ members: [] }))
			.mockResolvedValueOnce(response({}));
		await service.save(did, session, "24h");
		const writes = session.fetchHandler.mock.calls.filter(
			([, init]) => init.method === "POST",
		);
		expect(writes.map(([path]) => path)).toEqual([
			"/xrpc/com.atproto.simplespace.createSpace",
			"/xrpc/com.atproto.space.putRecord",
		]);
		expect(JSON.parse(writes[0][1].body)).toMatchObject({
			readPolicy: privatePolicy,
			writePolicy: privatePolicy,
		});
		expect(JSON.parse(writes[1][1].body)).toMatchObject({
			repo: did,
			collection: "xyz.opnshelf.privateSettings",
			record: value,
		});
	});
	it.each(["public", "member"])(
		"refuses to write to a pre-existing %s Space",
		async (kind) => {
			const { service, session } = fixture();
			const policy =
				kind === "public"
					? {
							...config,
							readPolicy: {
								$type: "com.atproto.simplespace.defs#publicPolicy",
							},
						}
					: config;
			session.fetchHandler
				.mockResolvedValueOnce(response(policy))
				.mockResolvedValueOnce(response(policy))
				.mockResolvedValueOnce(
					response({ members: [{ did: "did:plc:other" }] }),
				);
			await expect(service.save(did, session, "24h")).rejects.toBeInstanceOf(
				BadGatewayException,
			);
			expect(
				session.fetchHandler.mock.calls.every(
					([, init]) => init.method === "GET",
				),
			).toBe(true);
		},
	);
	it("does not recreate a Space on a network failure", async () => {
		const { service, session } = fixture();
		session.fetchHandler.mockRejectedValue(new Error("offline"));
		await expect(service.save(did, session, "24h")).rejects.toThrow(
			"not changed locally",
		);
		expect(session.fetchHandler).toHaveBeenCalledTimes(1);
	});
	it("deletes only the private record and treats missing as success", async () => {
		const { service, session } = fixture();
		session.fetchHandler.mockResolvedValue(
			response({ error: "RecordNotFound" }, 400),
		);
		await service.delete(did, session);
		expect(session.fetchHandler).toHaveBeenCalledWith(
			"/xrpc/com.atproto.space.deleteRecord",
			expect.objectContaining({ method: "POST" }),
		);
	});
});
