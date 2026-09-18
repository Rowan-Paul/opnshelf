import { describe, expect, it } from "vitest";
import config from "./app.config";

/**
 * The release workflow uploads the exported Hermes source maps to PostHog with
 * `posthog-cli hermes upload --directory dist`, and that command rejects the
 * whole directory if any map in it is not a Hermes map. An export that includes
 * web emits a plain `.js.map` beside the `.hbc.map` files, which is what turned
 * the v1.4.1 release red. Re-adding web here breaks that upload again.
 */
describe("expo config platforms", () => {
	it("is set, so an export cannot fall back to every platform", () => {
		expect(config.platforms).toBeDefined();
	});

	it("excludes web, whose plain sourcemap fails the PostHog upload", () => {
		expect(config.platforms).not.toContain("web");
	});

	it("still targets both native clients", () => {
		expect(config.platforms).toEqual(["ios", "android"]);
	});
});
