import { afterEach, describe, expect, it } from "vitest";
import {
	forgetAccount,
	MAX_RECENT_ACCOUNTS,
	noteSignInMethod,
	parseRecentAccounts,
	RECENT_ACCOUNTS_KEY,
	readRecentAccounts,
	rememberAccount,
} from "./recent-accounts";

const user = (n: number) => ({
	did: `did:plc:${n}`,
	handle: `user${n}.opnshelf.social`,
	displayName: `User ${n}`,
	avatar: null,
});

afterEach(() => localStorage.clear());

describe("recent accounts", () => {
	it("puts the latest sign-in first and keeps at most three", () => {
		for (const n of [1, 2, 3, 4, 2]) rememberAccount(user(n));
		expect(readRecentAccounts().map((a) => a.did)).toEqual([
			"did:plc:2",
			"did:plc:4",
			"did:plc:3",
		]);
		expect(readRecentAccounts()).toHaveLength(MAX_RECENT_ACCOUNTS);
	});

	it("records the method of the sign-in that just finished, once", () => {
		noteSignInMethod("google");
		rememberAccount(user(1));
		expect(readRecentAccounts()[0]?.method).toBe("google");

		// A later page load keeps the method instead of falling back to Handle.
		rememberAccount({ ...user(1), displayName: "Renamed" });
		expect(readRecentAccounts()[0]).toMatchObject({
			method: "google",
			displayName: "Renamed",
		});

		noteSignInMethod("handle");
		rememberAccount(user(1));
		expect(readRecentAccounts()[0]?.method).toBe("handle");
	});

	it("defaults to Handle sign-in, which works for every account", () => {
		rememberAccount(user(1));
		expect(readRecentAccounts()[0]?.method).toBe("handle");
	});

	it("forgets one account and leaves the rest", () => {
		rememberAccount(user(1));
		rememberAccount(user(2));
		forgetAccount("did:plc:2");
		expect(readRecentAccounts().map((a) => a.did)).toEqual(["did:plc:1"]);
	});

	it("drops malformed stored entries instead of failing", () => {
		localStorage.setItem(
			RECENT_ACCOUNTS_KEY,
			JSON.stringify([{ did: 1 }, { ...user(1), method: "handle" }, "x"]),
		);
		expect(readRecentAccounts().map((a) => a.did)).toEqual(["did:plc:1"]);
		expect(parseRecentAccounts("not json")).toEqual([]);
	});
});
