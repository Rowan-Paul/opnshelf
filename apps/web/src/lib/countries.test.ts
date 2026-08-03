import { afterEach, describe, expect, it, vi } from "vitest";
import { guessWatchCountry } from "./countries";

function withLanguage(language: string) {
	vi.stubGlobal("navigator", { language });
}

afterEach(() => vi.unstubAllGlobals());

describe("guessWatchCountry", () => {
	it.each([
		["nl-NL", "NL"],
		["nl", "NL"],
		["en-GB", "GB"],
	])("maps browser language %s to %s", (language, expected) => {
		withLanguage(language);
		expect(guessWatchCountry()).toBe(expected);
	});

	it.each([
		"la-VA",
		"not a locale",
		"",
	])("falls back to US for %s", (language) => {
		withLanguage(language);
		expect(guessWatchCountry()).toBe("US");
	});

	it("falls back to US without a navigator", () => {
		vi.stubGlobal("navigator", undefined);
		expect(guessWatchCountry()).toBe("US");
	});
});
