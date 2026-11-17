import {
	BINGERS_INTEGRATION,
	integrationDirections,
	integrationRecords,
	TRAKT_INTEGRATION,
	withCapabilities,
} from "@opnshelf/api";
import { expect, it } from "vitest";

it("takes record types, directions and connect method from the server's status", () => {
	const narrowed = withCapabilities(TRAKT_INTEGRATION, {
		capabilities: {
			records: ["watches"],
			directions: ["inbound"],
			connect: "repository",
		},
	});
	expect(integrationRecords(narrowed).map((r) => r.value)).toEqual(["watches"]);
	expect(integrationDirections(narrowed).map((d) => d.value)).toEqual([
		"inbound",
	]);
	expect(narrowed.connect).toBe("repository");
	expect(narrowed.api).toBe(TRAKT_INTEGRATION.api);
});

it("keeps the built-in definition until a status has loaded, or from an older server", () => {
	expect(withCapabilities(BINGERS_INTEGRATION, undefined)).toBe(
		BINGERS_INTEGRATION,
	);
	expect(withCapabilities(BINGERS_INTEGRATION, {})).toBe(BINGERS_INTEGRATION);
});
