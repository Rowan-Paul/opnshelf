import type { AppIntentInvocation } from "expo-app-intents";
import { describe, expect, it } from "vitest";
import { appShortcutDestination } from "./app-shortcut-destination";
import { parseWatchlistInput } from "./app-shortcut-input";

const user = { handle: "local.test" };
function intent(
	name: string,
	params: Record<string, unknown> = {},
): AppIntentInvocation {
	return { id: "request", name, params, createdAt: 1 };
}
describe("App Shortcut destinations", () => {
	it("opens the current user's Up Next and watchlist", () => {
		expect(appShortcutDestination(intent("openUpNext"), user)).toBe(
			"/profile/local.test/up-next",
		);
		expect(appShortcutDestination(intent("openWatchlist"), user)).toEqual({
			pathname: "/lists/[slug]",
			params: { slug: "watchlist", addInput: "", shortcutRequest: "request" },
		});
	});
	it.each([
		1, 30, 45, 90, 1440,
	])("carries a variable %i minute budget and type to the chooser", (minutes) => {
		expect(
			appShortcutDestination(
				intent("openTimedPickForMe", { minutes, type: "show" }),
				user,
			),
		).toEqual({
			pathname: "/pick-for-me",
			params: {
				minutes: String(minutes),
				type: "show",
				shortcutRequest: "request",
			},
		});
	});
	it.each([
		0,
		-1,
		1441,
		3.5,
		"45",
		null,
	])("rejects an invalid time %j", (minutes) => {
		expect(
			appShortcutDestination(
				intent("openTimedPickForMe", { minutes, type: "both" }),
				user,
			),
		).toBeNull();
	});
	it("rejects invalid types and empty or oversized text", () => {
		expect(
			appShortcutDestination(
				intent("openTimedPickForMe", { minutes: 45, type: "episode" }),
				user,
			),
		).toBeNull();
		for (const query of ["", " ", "a".repeat(201), 1])
			expect(
				appShortcutDestination(intent("searchTitles", { query }), user),
			).toBeNull();
		expect(appShortcutDestination(intent("other"), user)).toBeUndefined();
	});
	it("prefills search and permits guest searching", () => {
		expect(
			appShortcutDestination(
				intent("searchTitles", { query: " Severance " }),
				null,
			),
		).toEqual({
			pathname: "/search",
			params: { q: "Severance", shortcutRequest: "request" },
		});
	});
	it("applies account gates before private destinations", () => {
		for (const name of [
			"openPickForMe",
			"openUpNext",
			"openWatchlist",
			"addToWatchlist",
		]) {
			const request = intent(name, { input: "Severance" });
			expect(appShortcutDestination(request, null)).toBe("/login");
			expect(
				appShortcutDestination(request, {
					...user,
					needsEmailVerification: true,
					needsOnboarding: true,
				}),
			).toBe("/verify-email");
			expect(
				appShortcutDestination(request, { ...user, needsOnboarding: true }),
			).toBe("/onboarding");
		}
	});
	it("opens a confirmation flow without performing a mutation", () => {
		expect(
			appShortcutDestination(
				intent("addToWatchlist", { input: " Severance " }),
				user,
			),
		).toEqual({
			pathname: "/lists/[slug]",
			params: {
				slug: "watchlist",
				addInput: "Severance",
				shortcutRequest: "request",
			},
		});
	});
});
describe("watchlist title/link input", () => {
	it("keeps titles and resolves links to authoritative IDs", () => {
		expect(parseWatchlistInput(" Severance ")).toEqual({ query: "Severance" });
		expect(
			parseWatchlistInput("https://opnshelf.xyz/shows/95396/severance"),
		).toEqual({ mediaType: "show", mediaId: "95396" });
		expect(
			parseWatchlistInput("https://www.themoviedb.org/movie/550-fight-club"),
		).toEqual({ mediaType: "movie", mediaId: "550" });
	});
	it.each([
		"https://evil.test/movies/550/title",
		"https://opnshelf.xyz.evil.test/movies/550/title",
		"https://user:pass@opnshelf.xyz/movies/550/title",
		"https://opnshelf.xyz:123/movies/550/title",
		"file:///movies/550/title",
		"https://opnshelf.xyz/shows/1/name/seasons/2",
		"https://opnshelf.xyz/movies/99999999999999999/title",
		"https://opnshelf.xyz/movie/550",
		"https://themoviedb.org/shows/1/name",
		"www.opnshelf.xyz/movies/550/title",
		"",
		"a".repeat(201),
	])("rejects unsupported input %s", (value) =>
		expect(parseWatchlistInput(value)).toBeNull());
});
