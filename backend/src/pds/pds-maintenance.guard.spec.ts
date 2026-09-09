import {
	type ExecutionContext,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import {
	PdsMaintenanceGuard,
	PDS_MAINTENANCE_MESSAGE,
} from "./pds-maintenance.guard";

function contextFor(
	method: string,
	path: string,
	response = { setHeader: vi.fn() },
) {
	return {
		switchToHttp: () => ({
			getRequest: () => ({ method, path, url: path }),
			getResponse: () => response,
		}),
	} as unknown as ExecutionContext;
}

describe("PdsMaintenanceGuard", () => {
	it("leaves all traffic alone when maintenance is disabled", () => {
		const guard = new PdsMaintenanceGuard({
			get: () => "false",
		} as unknown as ConfigService);
		expect(guard.canActivate(contextFor("POST", "/auth/register"))).toBe(true);
	});

	it("keeps public reads available during maintenance", () => {
		const guard = new PdsMaintenanceGuard({
			get: () => "true",
		} as unknown as ConfigService);
		expect(guard.canActivate(contextFor("GET", "/movies"))).toBe(true);
	});

	it("returns 503 semantics and Retry-After for writes", () => {
		const response = { setHeader: vi.fn() };
		const guard = new PdsMaintenanceGuard({
			get: (key: string) => (key === "PDS_MAINTENANCE_MODE" ? "true" : "120"),
		} as unknown as ConfigService);
		expect(() =>
			guard.canActivate(contextFor("POST", "/auth/register", response)),
		).toThrow(new ServiceUnavailableException(PDS_MAINTENANCE_MESSAGE));
		expect(response.setHeader).toHaveBeenCalledWith("Retry-After", "120");
	});

	it("blocks OAuth authentication completion routes during maintenance", () => {
		const guard = new PdsMaintenanceGuard({
			get: () => "true",
		} as unknown as ConfigService);
		expect(() =>
			guard.canActivate(contextFor("GET", "/auth/callback")),
		).toThrow(ServiceUnavailableException);
	});

	it("blocks the mobile handoff exchange during maintenance", () => {
		const guard = new PdsMaintenanceGuard({
			get: () => "true",
		} as unknown as ConfigService);
		expect(() =>
			guard.canActivate(contextFor("POST", "/auth/mobile/exchange")),
		).toThrow(ServiceUnavailableException);
	});
});
