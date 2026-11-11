import { ServiceUnavailableException } from "@nestjs/common";
import { expect, it } from "vitest";
import {
	IntegrationUnavailable,
	integrationFailure,
} from "./integration-error";

it("recovers typed adapter failures through SDK wrappers", () => {
	const failure = new IntegrationUnavailable("Provider unavailable", 503, 900);
	expect(integrationFailure(new Error("SDK wrapper", { cause: failure }))).toBe(
		failure,
	);
});

it("does not reinterpret arbitrary HTTP errors as repository failures", () => {
	const error = new ServiceUnavailableException("Database unavailable");
	expect(integrationFailure(error)).toBe(error);
	const cycle = new Error("cycle");
	cycle.cause = cycle;
	expect(integrationFailure(cycle)).toBe(cycle);
});
