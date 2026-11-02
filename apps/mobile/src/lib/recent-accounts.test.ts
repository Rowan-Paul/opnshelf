import { beforeEach, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
	getItemAsync: vi.fn(),
	setItemAsync: vi.fn(),
}));
vi.mock("expo-secure-store", () => storage);

const user = (n: number) => ({
	did: `did:plc:${n}`,
	handle: `user${n}.opnshelf.social`,
	displayName: `User ${n}`,
	avatar: null,
});

beforeEach(() => {
	vi.resetModules();
	vi.resetAllMocks();
	storage.getItemAsync.mockResolvedValue(null);
	storage.setItemAsync.mockResolvedValue(undefined);
});

function saved() {
	const calls = storage.setItemAsync.mock.calls;
	return JSON.parse(calls[calls.length - 1]?.[1] ?? "[]") as Array<{
		did: string;
		method: string;
	}>;
}

it("keeps the three latest sign-ins, newest first, with their method", async () => {
	const recent = await import("./recent-accounts");
	for (const n of [1, 2, 3]) await recent.rememberAccount(user(n));
	recent.noteSignInMethod("apple");
	await recent.rememberAccount(user(4));
	expect(saved().map((a) => a.did)).toEqual([
		"did:plc:4",
		"did:plc:3",
		"did:plc:2",
	]);
	expect(saved()[0]?.method).toBe("apple");
});

it("keeps an account's method across launches that sign nobody in", async () => {
	storage.getItemAsync.mockResolvedValue(
		JSON.stringify([{ ...user(1), method: "google" }]),
	);
	const recent = await import("./recent-accounts");
	await recent.rememberAccount({ ...user(1), displayName: "Renamed" });
	expect(saved()[0]).toMatchObject({
		method: "google",
		displayName: "Renamed",
	});
});

it("applies a removal after a pending sign-in write", async () => {
	const recent = await import("./recent-accounts");
	void recent.rememberAccount(user(1));
	await recent.forgetAccount("did:plc:1");
	expect(saved()).toEqual([]);
});

it("treats unreadable storage as no remembered accounts", async () => {
	storage.getItemAsync.mockResolvedValue("not json");
	const recent = await import("./recent-accounts");
	await recent.loadRecentAccounts();
	expect(recent.parseRecentAccounts("not json")).toEqual([]);
});
