import { beforeEach, describe, expect, it, vi } from "vitest";

const getLocales = vi.fn();
vi.mock("expo-localization", () => ({ getLocales: () => getLocales() }));

const { guessWatchCountry } = await import("./countries");

describe("guessWatchCountry", () => {
	beforeEach(() => getLocales.mockReset());

	it("uses the device region when it is a supported country", () => {
		getLocales.mockReturnValue([{ regionCode: "NL" }]);
		expect(guessWatchCountry()).toBe("NL");
	});

	it("falls back to US for unsupported or missing regions", () => {
		getLocales.mockReturnValue([{ regionCode: "VA" }]);
		expect(guessWatchCountry()).toBe("US");
		getLocales.mockReturnValue([{ regionCode: null }]);
		expect(guessWatchCountry()).toBe("US");
		getLocales.mockReturnValue([]);
		expect(guessWatchCountry()).toBe("US");
	});
});
