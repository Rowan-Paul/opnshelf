import { describe, expect, it } from "vitest";
import { candidates, decide, equivalent, type SyncRecord } from "./reconcile";

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
});
