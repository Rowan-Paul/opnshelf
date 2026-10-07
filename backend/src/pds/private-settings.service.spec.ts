import { PRIVATE_SETTINGS_SCOPE } from "../auth/oauth-scopes";
import { PrivateSettingsService } from "./private-settings.service";
const did = "did:plc:owner";
function fixture() {
	const session = {
		did,
		getTokenInfo: vi.fn().mockResolvedValue({ scope: PRIVATE_SETTINGS_SCOPE }),
		fetchHandler: vi.fn().mockResolvedValue(Response.json({})),
	};
	return {
		session,
		service: new PrivateSettingsService(),
	};
}
describe("retired Settings cleanup", () => {
	it("deletes only the experimental Settings Space, even with the old flag off", async () => {
		const { service, session } = fixture();
		await service.delete(did, session);
		expect(session.fetchHandler).toHaveBeenCalledExactlyOnceWith(
			"/xrpc/com.atproto.simplespace.deleteSpace",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					space: `at://${did}/space/xyz.opnshelf.settings/self`,
				}),
			}),
		);
	});
	it.each(["SpaceNotFound", "SpaceDeleted"])(
		"is idempotent for %s",
		async (error) => {
			const { service, session } = fixture();
			session.fetchHandler.mockResolvedValue(
				Response.json({ error }, { status: 400 }),
			);
			await expect(service.delete(did, session)).resolves.toBeUndefined();
		},
	);
	it("requires the deletion grant and never borrows another owner's session", async () => {
		const { service, session } = fixture();
		await expect(service.delete("did:plc:other", session)).rejects.toThrow(
			"Sign in again",
		);
		session.getTokenInfo.mockResolvedValue({ scope: "atproto" });
		await expect(service.delete(did, session)).rejects.toThrow("Sign in again");
		expect(session.fetchHandler).not.toHaveBeenCalled();
	});
	it("does not mark a remote failure as successful cleanup", async () => {
		const { service, session } = fixture();
		session.fetchHandler.mockResolvedValue(
			Response.json({ error: "InternalServerError" }, { status: 500 }),
		);
		await expect(service.delete(did, session)).rejects.toThrow(
			"Could not remove",
		);
	});
});
