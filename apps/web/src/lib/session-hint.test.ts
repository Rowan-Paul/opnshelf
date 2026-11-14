import { describe, expect, it } from "vitest";
import { hasHintWithoutSession, hasSignedInHint } from "./session-hint";

describe("hasSignedInHint", () => {
	it("is set by the hint cookie or a session cookie the Web server can see", () => {
		expect(hasSignedInHint("theme=dark; opnshelf_signed_in=1")).toBe(true);
		expect(hasSignedInHint("opnshelf_session=abc")).toBe(true);
	});

	it("is absent without either cookie, or with a cleared hint", () => {
		expect(hasSignedInHint(undefined)).toBe(false);
		expect(hasSignedInHint("theme=dark")).toBe(false);
		expect(hasSignedInHint("opnshelf_signed_in=")).toBe(false);
		expect(hasSignedInHint("opnshelf_signed_in_other=1")).toBe(false);
	});
});

describe("hasHintWithoutSession", () => {
	it("is set when only the hint reaches the Web server", () => {
		expect(hasHintWithoutSession("theme=dark; opnshelf_signed_in=1")).toBe(
			true,
		);
	});

	it("is absent for a signed-out visitor or a session that can be forwarded", () => {
		expect(hasHintWithoutSession(undefined)).toBe(false);
		expect(hasHintWithoutSession("theme=dark")).toBe(false);
		expect(
			hasHintWithoutSession("opnshelf_signed_in=1; opnshelf_session=abc"),
		).toBe(false);
	});
});
