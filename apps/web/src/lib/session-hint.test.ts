import { describe, expect, it } from "vitest";
import { hasSignedInHint } from "./session-hint";

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
