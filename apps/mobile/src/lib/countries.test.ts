import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getLocales = vi.fn();
vi.mock("expo-localization", () => ({ getLocales: () => getLocales() }));

const { guessWatchCountry } = await import("./countries");

afterEach(() => vi.restoreAllMocks());

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
		getLocales.mockReturnValue([{ regionCode: "US" }]);
		expect(guessWatchCountry(timezone)).toBe(expected);
	});

	it.each([
		"UTC",
		"Etc/GMT-1",
		"Africa/Cairo",
		"invalid",
		"",
	])("uses the locale fallback for unmapped timezone %s", (timezone) => {
		getLocales.mockReturnValue([{ regionCode: "NL" }]);
		expect(guessWatchCountry(timezone)).toBe("NL");
	});

	it("detects the runtime timezone when none is supplied", () => {
		vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
			...new Intl.DateTimeFormat().resolvedOptions(),
			timeZone: "Europe/Amsterdam",
		});
		getLocales.mockReturnValue([{ regionCode: "US" }]);
		expect(guessWatchCountry()).toBe("NL");
	});

	it("uses the locale fallback if timezone detection fails", () => {
		getLocales.mockReturnValue([{ regionCode: "NL" }]);
		vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
			throw new Error("Timezone unavailable");
		});
		expect(guessWatchCountry()).toBe("NL");
	});

	beforeEach(() => getLocales.mockReset());

	it("uses the device region when it is a supported country", () => {
		getLocales.mockReturnValue([{ regionCode: "NL" }]);
		expect(guessWatchCountry("UTC")).toBe("NL");
	});

	it("falls back to US for unsupported or missing regions", () => {
		getLocales.mockReturnValue([{ regionCode: "VA" }]);
		expect(guessWatchCountry("UTC")).toBe("US");
		getLocales.mockReturnValue([{ regionCode: null }]);
		expect(guessWatchCountry("UTC")).toBe("US");
		getLocales.mockReturnValue([]);
		expect(guessWatchCountry("UTC")).toBe("US");
	});
});
