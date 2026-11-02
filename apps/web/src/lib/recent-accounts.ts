import type { UserDto } from "@opnshelf/api";
import { useSyncExternalStore } from "react";

/**
 * Accounts this browser signed in to recently, so the login page can offer
 * them as one tap instead of asking for the Handle again after a session ends.
 *
 * Device-local and non-secret: only what the profile already shows publicly,
 * plus how the account last signed in. It grants nothing; tapping a row starts
 * the same sign-in a typed Handle or provider button would.
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
export const RECENT_ACCOUNTS_KEY = "opnshelf_recent_accounts";
/**
 * The method of a sign-in that left the page. A provider sign-in is a full
 * redirect through the API, so the page that learns who signed in is not the
 * one that knew how.
 */
export const PENDING_SIGN_IN_METHOD_KEY = "opnshelf_sign_in_method";

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

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedAccounts: RecentAccount[] = EMPTY;

function storage(): Storage | null {
	try {
		return typeof window === "undefined" ? null : window.localStorage;
	} catch {
		// Storage can throw outright when the browser blocks it.
		return null;
	}
}

export function readRecentAccounts(): RecentAccount[] {
	const raw = storage()?.getItem(RECENT_ACCOUNTS_KEY) ?? null;
	if (raw !== cachedRaw) {
		cachedRaw = raw;
		cachedAccounts = parseRecentAccounts(raw);
	}
	return cachedAccounts;
}

function writeRecentAccounts(accounts: RecentAccount[]): void {
	try {
		storage()?.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(accounts));
	} catch {
		// A full or blocked store only costs the shortcut.
	}
	for (const listener of listeners) listener();
}

/** Records how the sign-in that is about to leave this page will happen. */
export function noteSignInMethod(method: SignInMethod): void {
	try {
		storage()?.setItem(PENDING_SIGN_IN_METHOD_KEY, method);
	} catch {
		// Without it the account is remembered with its previous method.
	}
}

function takePendingSignInMethod(): SignInMethod | null {
	const store = storage();
	const value = store?.getItem(PENDING_SIGN_IN_METHOD_KEY) ?? null;
	if (value === null) return null;
	store?.removeItem(PENDING_SIGN_IN_METHOD_KEY);
	return METHODS.includes(value as SignInMethod)
		? (value as SignInMethod)
		: null;
}

/**
 * Remembers the signed-in user, refreshing the name and avatar shown on the
 * login page. The method comes from the sign-in that just finished, else the
 * account's previous one, else a Handle, which works for every account.
 */
export function rememberAccount(
	user: Pick<UserDto, "did" | "handle" | "displayName" | "avatar">,
): void {
	const accounts = readRecentAccounts();
	const previous = accounts.find((account) => account.did === user.did);
	const method = takePendingSignInMethod() ?? previous?.method ?? "handle";
	const next: RecentAccount = {
		did: user.did,
		handle: user.handle,
		displayName: user.displayName,
		avatar: user.avatar,
		method,
	};
	// Every page load re-confirms the user; skip the write when nothing moved.
	if (JSON.stringify(accounts[0]) === JSON.stringify(next)) return;
	writeRecentAccounts(withRecentAccount(accounts, next));
}

/** Forgets one account, for the remove button and for a deleted account. */
export function forgetAccount(did: string): void {
	const accounts = readRecentAccounts();
	if (!accounts.some((account) => account.did === did)) return;
	writeRecentAccounts(accounts.filter((account) => account.did !== did));
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	// Another tab signing in or forgetting an account.
	const onStorage = (event: StorageEvent) => {
		if (event.key === RECENT_ACCOUNTS_KEY) listener();
	};
	window.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", onStorage);
	};
}

export function useRecentAccounts(): RecentAccount[] {
	return useSyncExternalStore(subscribe, readRecentAccounts, () => EMPTY);
}
