import { describe, expect, it } from "vitest";
import { buildSsrAuthHeaders } from "@/lib/ssr-auth-headers";

describe("ssr-auth-headers", () => {
	it("returns empty options when no cookie header is present", () => {
		expect(buildSsrAuthHeaders(undefined)).toEqual({});
		expect(buildSsrAuthHeaders(null)).toEqual({});
		expect(buildSsrAuthHeaders("")).toEqual({});
	});

	it("forwards the incoming cookie header for SSR API requests", () => {
		expect(buildSsrAuthHeaders("session=opaque-id; theme=dark")).toEqual({
			headers: {
				Cookie: "session=opaque-id; theme=dark",
			},
		});
	});
});
