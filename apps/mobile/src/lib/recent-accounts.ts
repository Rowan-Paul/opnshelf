import type { UserDto } from "@opnshelf/api";
import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";

/**
 * Accounts this device signed in to recently, so the login screen can offer
 * them as one tap instead of asking for the Handle again after a session ends.
 *
 * Device-local and non-secret: only what the profile already shows publicly,
 * plus how the account last signed in. It grants nothing; tapping a row starts
 * the same sign-in a typed Handle or provider button would. Mirrors the Web
 * App's `recent-accounts.ts`.
 */
export type SignInMethod = "handle" | "google" | "apple";

export interface RecentAccount {
	did: string;
	handle: string;
	displayName: string | null;
	avatar: string | null;
	method: SignInMethod;
}

export const MAX_RECENT_ACCOUNTS = 3;
export const RECENT_ACCOUNTS_KEY = "recent_accounts";

const EMPTY: RecentAccount[] = [];
const METHODS: readonly SignInMethod[] = ["handle", "google", "apple"];

function isRecentAccount(value: unknown): value is RecentAccount {
	if (!value || typeof value !== "object") return false;
	const account = value as Record<string, unknown>;
	return (
		typeof account.did === "string" &&
		typeof account.handle === "string" &&
		(account.displayName === null || typeof account.displayName === "string") &&
		(account.avatar === null || typeof account.avatar === "string") &&
		METHODS.includes(account.method as SignInMethod)
	);
}

/** Parses stored accounts, dropping anything malformed rather than failing. */
export function parseRecentAccounts(raw: string | null): RecentAccount[] {
	if (!raw) return EMPTY;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return EMPTY;
		return parsed.filter(isRecentAccount).slice(0, MAX_RECENT_ACCOUNTS);
	} catch {
		return EMPTY;
	}
}

/** Puts an account first, replacing any older entry for the same DID. */
export function withRecentAccount(
	accounts: RecentAccount[],
	account: RecentAccount,
): RecentAccount[] {
	return [
		account,
		...accounts.filter((existing) => existing.did !== account.did),
	].slice(0, MAX_RECENT_ACCOUNTS);
}

let accounts: RecentAccount[] = EMPTY;
let loading: Promise<void> | undefined;
// Changes are applied in order, so a remove right after a sign-in never
// writes a list that still holds the removed account.
let writing: Promise<void> = Promise.resolve();
let pendingMethod: SignInMethod | null = null;
const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) listener();
}

/** Started with the app, so the login screen never shows its rows popping in. */
export function loadRecentAccounts(): Promise<void> {
	loading ??= SecureStore.getItemAsync(RECENT_ACCOUNTS_KEY)
		.then(
			(raw) => {
				accounts = parseRecentAccounts(raw);
			},
			() => {
				accounts = EMPTY;
			},
		)
		.then(emit);
	return loading;
}

function update(change: (current: RecentAccount[]) => RecentAccount[]) {
	writing = writing.then(async () => {
		await loadRecentAccounts();
		const next = change(accounts);
		if (next === accounts) return;
		accounts = next;
		emit();
		try {
			await SecureStore.setItemAsync(RECENT_ACCOUNTS_KEY, JSON.stringify(next));
		} catch (error) {
			// A failed write only costs the shortcut next time.
			console.error("Failed to save recent accounts", error);
		}
	});
	return writing;
}

/** Records how the sign-in that is starting will happen. */
export function noteSignInMethod(method: SignInMethod): void {
	pendingMethod = method;
}

/**
 * Remembers the signed-in user, refreshing the name and avatar shown on the
 * login screen. The method comes from the sign-in that just finished, else the
 * account's previous one, else a Handle, which works for every account.
 */
export function rememberAccount(
	user: Pick<UserDto, "did" | "handle" | "displayName" | "avatar">,
): Promise<void> {
	const method = pendingMethod;
	pendingMethod = null;
	return update((current) => {
		const previous = current.find((account) => account.did === user.did);
		const next: RecentAccount = {
			did: user.did,
			handle: user.handle,
			displayName: user.displayName,
			avatar: user.avatar,
			method: method ?? previous?.method ?? "handle",
		};
		// Every launch re-confirms the user; skip the write when nothing moved.
		if (JSON.stringify(current[0]) === JSON.stringify(next)) return current;
		return withRecentAccount(current, next);
	});
}

/** Forgets one account, for the remove button and for a deleted account. */
export function forgetAccount(did: string): Promise<void> {
	return update((current) =>
		current.some((account) => account.did === did)
			? current.filter((account) => account.did !== did)
			: current,
	);
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	void loadRecentAccounts();
	return () => {
		listeners.delete(listener);
	};
}

export function useRecentAccounts(): RecentAccount[] {
	return useSyncExternalStore(
		subscribe,
		() => accounts,
		() => EMPTY,
	);
}
