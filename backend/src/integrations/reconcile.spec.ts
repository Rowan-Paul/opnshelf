import { describe, expect, it } from "vitest";
import { encodeList } from "./list-value";
import {
	candidates,
	decide,
	equivalent,
	readRecord,
	type SyncRecord,
} from "./reconcile";

const watch: SyncRecord = {
	key: "one",
	kind: "watch",
	mediaType: "movie",
	mediaId: "12",
	season: 0,
	episode: 0,
	title: "Movie",
	value: "2020-01-01T12:00:25.000Z",
};
const remote = { ...watch, key: "remote", value: "2020-01-01T12:00:00.000Z" };
const base = {
	linked: true,
	eligible: true,
	localBase: watch,
	remoteBase: remote,
};
describe("Trakt reconciliation", () => {
	it("preserves local second precision without echoing normalized Trakt time", () => {
		expect(equivalent(watch, remote)).toBe(true);
		expect(decide(base, watch, remote, "both")).toBe("none");
	});
	it("propagates a linked deletion but never deletes an unrelated destination", () => {
		expect(decide(base, null, remote, "outbound")).toBe("push");
		expect(decide({ ...base, linked: false }, null, remote, "outbound")).toBe(
			"none",
		);
	});
	it("requires a choice for edit versus deletion", () => {
		expect(decide(base, { ...watch, value: null }, null, "both")).toBe(
			"conflict",
		);
	});
	it("recognizes future changes by record value, not historical watch date", () => {
		const excluded = {
			...base,
			linked: false,
			eligible: false,
			remoteBase: null,
		};
		expect(decide(excluded, watch, null, "both")).toBe("none");
		expect(
			decide(
				excluded,
				{ ...watch, value: "1990-01-01T12:00:00Z" },
				null,
				"both",
			),
		).toBe("push");
	});
	it("does not auto-select an initial rating winner from timestamps", () => {
		const a: SyncRecord = { ...watch, kind: "rating", value: 7 };
		const b: SyncRecord = { ...a, value: 9 };
		expect(
			decide(
				{ linked: false, eligible: true, localBase: a, remoteBase: b },
				a,
				b,
				"both",
			),
		).toBe("conflict");
		expect(decide({ ...base, linked: false }, a, b, "inbound")).toBe("pull");
	});
	it("identifies undated and nearby Watches as candidates requiring review", () => {
		expect(candidates({ ...watch, value: null }, [remote])).toEqual([remote]);
		expect(
			candidates(watch, [{ ...remote, value: "2020-01-01T12:03:00Z" }]),
		).toHaveLength(1);
	});
	it("reads remote identifiers saved under their pre-Integration names", () => {
		const legacy = readRecord({ ...remote, traktId: 7, traktParentId: 3 });
		expect(legacy).toMatchObject({ remoteId: 7, remoteParentId: 3 });
		expect(legacy).not.toHaveProperty("traktId");
		expect(readRecord({ ...remote, remoteId: 9 })).toEqual({
			...remote,
			remoteId: 9,
		});
	});
	it("keeps the remote version for current and pre-Integration choices", () => {
		const changed = { ...watch, value: "2021-01-01T12:00:00.000Z" };
		expect(decide(base, changed, remote, "both", "remote")).toBe("pull");
		expect(decide(base, changed, remote, "both", "trakt")).toBe("pull");
		expect(decide(base, watch, changed, "both", "opnshelf")).toBe("push");
	});
	it("treats a date-only remote Watch as any viewing on that calendar day", () => {
		// Noon in the owner's timezone stands for a date without a time.
		const dated = {
			...remote,
			value: "2020-01-01T12:00:00.000Z",
			dateOnly: true,
		};
		const evening = { ...watch, value: "2020-01-01T23:30:00.000Z" };
		const nextDay = { ...watch, value: "2020-01-02T00:30:00.000Z" };
		expect(equivalent(evening, dated)).toBe(true);
		expect(equivalent(nextDay, dated)).toBe(false);
		expect(candidates(dated, [evening, nextDay])).toEqual([evening]);
		// Precise Watches keep the five-minute window.
		expect(candidates(remote, [evening])).toEqual([]);
	});
	it("treats a remote that never stores Watch dates as the same viewing", () => {
		const episode = {
			...watch,
			mediaType: "episode" as const,
			season: 1,
			episode: 2,
		};
		const undated = { ...episode, key: "remote", value: null, undated: true };
		expect(equivalent(episode, undated)).toBe(true);
		expect(equivalent({ ...episode, episode: 3 }, undated)).toBe(false);
		// Without the flag a missing date is still a different viewing.
		expect(equivalent(episode, { ...undated, undated: undefined })).toBe(false);
	});
	it("ignores member order when one side keeps Lists unordered", () => {
		const member = (mediaId: string) => ({
			mediaType: "movie" as const,
			mediaId,
			season: 0,
			episode: 0,
			notes: "",
		});
		const list = (ids: string[], unordered?: boolean): SyncRecord => ({
			key: "list",
			kind: "list",
			mediaType: "list",
			mediaId: null,
			season: 0,
			episode: 0,
			title: "Weekend",
			value: encodeList({
				name: "Weekend",
				description: "",
				items: ids.map(member),
			}),
			...(unordered ? { unordered } : {}),
		});
		expect(equivalent(list(["1", "2"]), list(["2", "1"], true))).toBe(true);
		expect(equivalent(list(["1", "2"]), list(["2", "1"]))).toBe(false);
		expect(equivalent(list(["1"]), list(["1", "2"], true))).toBe(false);
	});
});
