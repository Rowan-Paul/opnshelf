import { expect, it, vi } from "vitest";
import { SyncSnapshotChanged } from "../integrations/integration-error";
import { PopfeedSyncService } from "./popfeed-sync.service";

const did = "did:plc:fixture";
const uri = `at://${did}/social.popfeed.feed.review/one`;
function fixture(reject?: unknown) {
	const call = vi.fn(async () => {
		if (reject) throw reject;
		return { data: {} };
	});
	const agent = {
		com: { atproto: { repo: { putRecord: call, deleteRecord: call } } },
	};
	const service = new PopfeedSyncService(
		{} as never,
		{} as never,
		{} as never,
		{ NODE_ENV: "test" } as never,
		{} as never,
		{} as never,
		{} as never,
	);
	const repo = service["repository"](agent as never, {
		did,
		pds: "https://pds.fixture.test",
		timeZone: "UTC",
	});
	return { repo, call };
}

it("sends the version it read with every update and removal", async () => {
	const f = fixture();
	const source = { uri, cid: "bafy-read", value: {} };
	await f.repo.put(source, { rating: 8 });
	await f.repo.remove(source);
	for (const [input] of f.call.mock.calls as unknown as [
		{ swapRecord?: string; rkey: string },
	][]) {
		expect(input.swapRecord).toBe("bafy-read");
		expect(input.rkey).toBe("one");
	}
	expect(f.call).toHaveBeenCalledTimes(2);
});

it.each(["put", "remove"] as const)(
	"asks for a fresh snapshot when Popfeed rejects a %s of a record that changed",
	async (method) => {
		const f = fixture({ error: "InvalidSwap", status: 400 });
		const source = { uri, cid: "bafy-read", value: {} };
		await expect(
			method === "put" ? f.repo.put(source, {}) : f.repo.remove(source),
		).rejects.toBeInstanceOf(SyncSnapshotChanged);
	},
);

it("keeps any other repository failure as it was", async () => {
	const failure = { error: "InvalidRequest", status: 400 };
	await expect(fixture(failure).repo.remove({ uri, value: {} })).rejects.toBe(
		failure,
	);
});
