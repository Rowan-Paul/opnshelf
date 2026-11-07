import type { ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of, throwError } from "rxjs";
import { beforeEach, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { captureProductEvent } from "./capture";
import { ProductAnalyticsInterceptor } from "./product-analytics.interceptor";

vi.mock("./capture", () => ({ captureProductEvent: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
const env = parseEnvironment({});
function context(
	controller: string,
	handler: string,
	body: Record<string, unknown>,
) {
	return {
		getClass: () => ({ name: controller }),
		getHandler: () => ({ name: handler }),
		switchToHttp: () => ({
			getRequest: () => ({ user: { did: "did:plc:fixture" }, body }),
		}),
	} as unknown as ExecutionContext;
}
it("captures only categorical preferences after success without tokens or content", async () => {
	const interceptor = new ProductAnalyticsInterceptor(env);
	await lastValueFrom(
		interceptor.intercept(
			context("NotificationsController", "updateSettings", {
				pushSyncErrors: false,
				token: "private-token",
				email: "private@example.test",
				pushStats: true,
			}),
			{ handle: () => of({ secret: "response" }) },
		),
	);
	expect(captureProductEvent).toHaveBeenCalledTimes(2);
	expect(captureProductEvent).toHaveBeenCalledWith(
		env,
		"did:plc:fixture",
		"notification_preference_changed",
		{ setting: "pushSyncErrors", enabled: false },
	);
	expect(JSON.stringify(vi.mocked(captureProductEvent).mock.calls)).not.toMatch(
		/private|secret/,
	);
});
it("does not report success when a controller fails", async () => {
	const stream = new ProductAnalyticsInterceptor(env).intercept(
		context("NotesController", "upsertNote", { content: "private" }),
		{ handle: () => throwError(() => new Error("failed")) },
	);
	await expect(lastValueFrom(stream)).rejects.toThrow("failed");
	expect(captureProductEvent).not.toHaveBeenCalled();
});
it("calls a visibility migration a request, excluding dynamic list identifiers", async () => {
	await lastValueFrom(
		new ProductAnalyticsInterceptor(env).intercept(
			context("PrivacyController", "change", {
				category: "notes",
				visibility: "private",
				listRkey: "private-id",
			}),
			{ handle: () => of({}) },
		),
	);
	expect(captureProductEvent).toHaveBeenCalledWith(
		env,
		"did:plc:fixture",
		"data_visibility_change_requested",
		{ category: "notes", visibility: "private" },
	);
});
