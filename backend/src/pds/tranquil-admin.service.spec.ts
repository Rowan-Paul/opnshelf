import { ConfigService } from "@nestjs/config";

const loginMock = vi.fn();
const createInviteCodeMock = vi.fn();
const disableInviteCodesMock = vi.fn();

// Mock AtpAgent: login() marks the agent authenticated; the XRPC namespaces
// delegate to our jest mocks.
vi.mock("@atproto/api", () => ({
	AtpAgent: vi.fn().mockImplementation(() => {
		const agent: Record<string, unknown> = {
			session: undefined,
			com: {
				atproto: {
					server: { createInviteCode: createInviteCodeMock },
					admin: { disableInviteCodes: disableInviteCodesMock },
				},
			},
		};
		agent.login = (...args: unknown[]) => {
			agent.session = { did: "did:plc:admin" };
			return loginMock(...args);
		};
		return agent;
	}),
}));

import { TranquilAdminService } from "./tranquil-admin.service";

function makeConfig(values: Record<string, string | undefined>): ConfigService {
	return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const fullConfig = makeConfig({
	PDS_URL: "https://opnshelf.xyz",
	PDS_ADMIN_IDENTIFIER: "admin.opnshelf.xyz",
	PDS_ADMIN_PASSWORD: "pw",
});

describe("TranquilAdminService", () => {
	beforeEach(() => {
		loginMock.mockReset().mockResolvedValue(undefined);
		createInviteCodeMock.mockReset();
		disableInviteCodesMock.mockReset().mockResolvedValue({});
	});

	it("logs in once and mints an invite code", async () => {
		createInviteCodeMock.mockResolvedValue({ data: { code: "opn-abc-123" } });
		const service = new TranquilAdminService(fullConfig);

		const code = await service.mintInviteCode(1);

		expect(code).toBe("opn-abc-123");
		expect(loginMock).toHaveBeenCalledTimes(1);
		expect(createInviteCodeMock).toHaveBeenCalledWith({ useCount: 1 });
	});

	it("reuses the session across calls (single login)", async () => {
		createInviteCodeMock.mockResolvedValue({ data: { code: "x" } });
		const service = new TranquilAdminService(fullConfig);

		await service.mintInviteCode();
		await service.mintInviteCode();

		expect(loginMock).toHaveBeenCalledTimes(1);
	});

	it("re-authenticates and retries once on an auth error", async () => {
		const authError = Object.assign(new Error("expired"), { status: 401 });
		createInviteCodeMock
			.mockRejectedValueOnce(authError)
			.mockResolvedValueOnce({ data: { code: "retry-code" } });
		const service = new TranquilAdminService(fullConfig);

		const code = await service.mintInviteCode();

		expect(code).toBe("retry-code");
		expect(loginMock).toHaveBeenCalledTimes(2);
	});

	it("throws when admin credentials are not configured", async () => {
		const service = new TranquilAdminService(makeConfig({}));
		await expect(service.mintInviteCode()).rejects.toThrow();
	});

	it("disables invite codes", async () => {
		const service = new TranquilAdminService(fullConfig);
		await service.disableInviteCodes(["a", "b"]);
		expect(disableInviteCodesMock).toHaveBeenCalledWith({ codes: ["a", "b"] });
	});

	it("no-ops disabling an empty list", async () => {
		const service = new TranquilAdminService(fullConfig);
		await service.disableInviteCodes([]);
		expect(disableInviteCodesMock).not.toHaveBeenCalled();
	});
});
