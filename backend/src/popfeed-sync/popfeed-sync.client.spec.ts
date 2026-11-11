import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { syncPdsRequests } from "../integrations/sync-pds";

beforeEach(() => {
	vi.spyOn(syncPdsRequests, "run").mockImplementation(async (_did, request) =>
		request(),
	);
});
import {
	IntegrationError,
	SyncSnapshotChanged,
} from "../integrations/integration-error";
import {
	type PopfeedCredential,
	PopfeedSyncClient,
} from "./popfeed-sync.client";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

/** A fake PDS whose commit revision the test controls. */
function pds(revisions: string[]) {
	let commits = 0;
	const fetch = vi.fn(async (url: URL) => {
		if (url.pathname.endsWith("com.atproto.sync.getLatestCommit")) {
			const rev = revisions[Math.min(commits, revisions.length - 1)];
			commits++;
			return Response.json({ cid: `cid-${rev}`, rev });
		}
		return Response.json({ records: [] });
	});
	vi.stubGlobal("fetch", fetch);
	const listings = () =>
		fetch.mock.calls.filter(([url]) =>
			url.pathname.endsWith("com.atproto.repo.listRecords"),
		).length;
	return { listings };
}

const credential = (): PopfeedCredential => ({
	did: "did:plc:fixture",
	pds: "https://pds.fixture.test",
	timeZone: "UTC",
});

it("reuses one repository read while the commit revision is unchanged", async () => {
	const { listings } = pds(["a"]);
	const client = new PopfeedSyncClient();
	const c = credential();
	await client.snapshot(c, { watches: true });
	await client.repository(c);
	await client.repository(c);
	expect(listings()).toBe(3);
});

it("reads again after the repository changes", async () => {
	// The first read is bracketed by "a"; the next check sees a write at "b".
	const { listings } = pds(["a", "a", "b"]);
	const client = new PopfeedSyncClient();
	const c = credential();
	await client.repository(c);
	await client.repository(c);
	expect(listings()).toBe(6);
	expect(c.read?.rev).toBe("b");
});

it("keeps each run's reads separate", async () => {
	const { listings } = pds(["a"]);
	const client = new PopfeedSyncClient();
	await client.repository(credential());
	await client.repository(credential());
	expect(listings()).toBe(6);
});

it("does not cache or return a snapshot that changed while it was read", async () => {
	pds(["a", "b"]);
	const client = new PopfeedSyncClient();
	const c = credential();
	await expect(client.snapshot(c, { watches: true })).rejects.toBeInstanceOf(
		IntegrationError,
	);
	expect(c.read).toBeUndefined();
});

it("never hands a writer a read the repository changed under", async () => {
	pds(["a", "b"]);
	const client = new PopfeedSyncClient();
	const c = credential();
	await expect(client.repository(c)).rejects.toBeInstanceOf(
		SyncSnapshotChanged,
	);
	expect(c.read).toBeUndefined();
});
