import type { StreamingServiceDto } from "@opnshelf/api";
import { describe, expect, it } from "vitest";
import {
	TOP_SERVICE_COUNT,
	toggleService,
	visibleServices,
} from "./StreamingServicePicker";

const services: StreamingServiceDto[] = Array.from(
	{ length: TOP_SERVICE_COUNT + 5 },
	(_, i) => ({
		id: i + 1,
		name: `Service ${i + 1}`,
		logoUrl: null,
		displayPriority: i,
	}),
);

describe("visibleServices", () => {
	it("keeps a fixed grid with chosen services first, even ones below the fold", () => {
		const shown = visibleServices(services, [TOP_SERVICE_COUNT + 3, 2], "");
		expect(shown).toHaveLength(TOP_SERVICE_COUNT);
		expect(shown.slice(0, 2).map((s) => s.id)).toEqual([
			2,
			TOP_SERVICE_COUNT + 3,
		]);
		// The two chosen ones displace the two least prominent top services.
		expect(shown.map((s) => s.id)).not.toContain(TOP_SERVICE_COUNT);
	});

	it("grows past the grid only when more than a grid's worth is chosen", () => {
		const all = services.map((s) => s.id);
		expect(visibleServices(services, all, "")).toHaveLength(services.length);
	});

	it("searches the whole list, not just the top, when a query is typed", () => {
		expect(visibleServices(services, [], "service 1")).toHaveLength(
			// "Service 1" and "Service 10" through "Service 17".
			9,
		);
		expect(visibleServices(services, [], "  SERVICE 17 ")).toEqual([
			services[TOP_SERVICE_COUNT + 4],
		]);
		expect(visibleServices(services, [], "nope")).toEqual([]);
	});
});

describe("toggleService", () => {
	it("adds a missing id and removes a present one without reordering", () => {
		expect(toggleService([8, 337], 2)).toEqual([8, 337, 2]);
		expect(toggleService([8, 337, 2], 337)).toEqual([8, 2]);
	});
});
