import { afterEach, describe, expect, it, vi } from "vitest";
import { guessWatchCountry } from "./countries";

function withLanguage(language: string) {
	vi.stubGlobal("navigator", { language });
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("guessWatchCountry", () => {
	it.each([
		["Europe/Amsterdam", "NL"],
		["Europe/London", "GB"],
		["Europe/Berlin", "DE"],
		["America/Toronto", "CA"],
		["America/Los_Angeles", "US"],
		["Australia/Perth", "AU"],
		["Asia/Kolkata", "IN"],
		["Asia/Calcutta", "IN"],
		["US/Eastern", "US"],
		["Pacific/Chatham", "NZ"],
	])("prefers timezone %s over the locale region (%s)", (timezone, expected) => {
		withLanguage("en-US");
		expect(guessWatchCountry(timezone)).toBe(expected);
	});

	it.each([
		"UTC",
		"Etc/GMT-1",
		"Africa/Cairo",
		"invalid",
		"",
	])("uses the locale fallback for unmapped timezone %s", (timezone) => {
		withLanguage("nl-NL");
		expect(guessWatchCountry(timezone)).toBe("NL");
	});

	it("detects the runtime timezone when none is supplied", () => {
		vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
			...new Intl.DateTimeFormat().resolvedOptions(),
			timeZone: "Europe/Amsterdam",
		});
		withLanguage("en-US");
		expect(guessWatchCountry()).toBe("NL");
	});

	it("uses the locale fallback if timezone detection fails", () => {
		withLanguage("nl-NL");
		vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
			throw new Error("Timezone unavailable");
		});
		expect(guessWatchCountry()).toBe("NL");
	});

	it.each([
		["nl-NL", "NL"],
		["nl", "NL"],
		["en-GB", "GB"],
	])("maps browser language %s to %s", (language, expected) => {
		withLanguage(language);
		expect(guessWatchCountry("UTC")).toBe(expected);
	});

	it.each([
		"la-VA",
		"not a locale",
		"",
	])("falls back to US for %s", (language) => {
		withLanguage(language);
		expect(guessWatchCountry("UTC")).toBe("US");
	});

	it("falls back to US without a navigator", () => {
		vi.stubGlobal("navigator", undefined);
		expect(guessWatchCountry("UTC")).toBe("US");
	});
});
