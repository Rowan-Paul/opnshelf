import { describe, expect, it } from "vitest";
import { extractSessionId } from "./session-id";

describe("extractSessionId", () => {
	it("prefers a trimmed bearer credential over the cookie", () => {
		expect(
			extractSessionId({
				headers: { authorization: "  Bearer bearer-session  " },
				cookies: { session: "cookie-session" },
			}),
		).toBe("bearer-session");
	});

	it("matches the bearer scheme case-insensitively", () => {
		expect(
			extractSessionId({
				headers: { authorization: "bEaReR bearer-session" },
			}),
		).toBe("bearer-session");
	});

	it("falls back to the cookie when authorization is missing", () => {
		expect(extractSessionId({ cookies: { session: "cookie-session" } })).toBe(
			"cookie-session",
		);
	});

	it("prefers the isolated cookie over a legacy parent-domain cookie", () => {
		expect(
			extractSessionId({
				cookies: {
					session: "production-session",
					opnshelf_session: "staging-session",
				},
			}),
		).toBe("staging-session");
	});

	it.each(["", "Bearer", "Bearer   ", "Basic value", "Bearer one two"])(
		"falls back to the cookie for malformed authorization %j",
		(authorization) => {
			expect(
				extractSessionId({
					headers: { authorization },
					cookies: { session: "cookie-session" },
				}),
			).toBe("cookie-session");
		},
	);

	it("returns undefined when neither credential is usable", () => {
		expect(
			extractSessionId({
				headers: { authorization: "Bearer one two" },
				cookies: { session: "  " },
			}),
		).toBeUndefined();
	});
});
