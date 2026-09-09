import type { UserDto } from "@opnshelf/api";
import { describe, expect, it, vi } from "vitest";
import {
	buildDisplayNameUpdate,
	extractErrorMessage,
	getResendLabel,
	isOnboardingStep,
	markOnboardingCompleted,
	nextOnboardingStep,
	ONBOARDING_STEPS,
	RESEND_COOLDOWN_SECONDS,
	resolveOnboardingCountry,
	shouldResumeTraktImport,
} from "./onboarding-steps";

describe("onboarding steps", () => {
	it("runs welcome through done in order", () => {
		expect(ONBOARDING_STEPS).toEqual([
			"welcome",
			"profile",
			"preferences",
			"trakt",
			"suggestions",
			"watched",
			"done",
		]);
	});

	it("advances to the linear successor", () => {
		expect(nextOnboardingStep("welcome")).toBe("profile");
		expect(nextOnboardingStep("profile")).toBe("preferences");
		expect(nextOnboardingStep("preferences")).toBe("trakt");
		expect(nextOnboardingStep("trakt")).toBe("suggestions");
		expect(nextOnboardingStep("suggestions")).toBe("watched");
		expect(nextOnboardingStep("watched")).toBe("done");
	});

	it("stays on done", () => {
		expect(nextOnboardingStep("done")).toBe("done");
	});

	it("recognises step ids and rejects unknown ones", () => {
		expect(isOnboardingStep("trakt")).toBe(true);
		expect(isOnboardingStep("Trakt")).toBe(false);
		expect(isOnboardingStep("verify")).toBe(false);
		expect(isOnboardingStep(undefined)).toBe(false);
		expect(isOnboardingStep(3)).toBe(false);
	});
});

describe("shouldResumeTraktImport", () => {
	it("is false while loading or when there is no job", () => {
		expect(shouldResumeTraktImport(undefined)).toBe(false);
		expect(shouldResumeTraktImport(null)).toBe(false);
	});

	it("resumes for known in-flight statuses", () => {
		for (const status of ["queued", "running", "waiting_retry"]) {
			expect(shouldResumeTraktImport({ id: "job", status })).toBe(true);
		}
	});

	it("does not resume for terminal or unknown statuses", () => {
		expect(shouldResumeTraktImport({ id: "job", status: "completed" })).toBe(
			false,
		);
		expect(shouldResumeTraktImport({ id: "job", status: "failed" })).toBe(
			false,
		);
		expect(shouldResumeTraktImport({ id: "job", status: "exploded" })).toBe(
			false,
		);
		// "paused" is in the DTO status union but not in the shared known list,
		// so a paused job is treated like an unknown one and does not resume.
		expect(shouldResumeTraktImport({ id: "job", status: "paused" })).toBe(
			false,
		);
	});

	it("requires a job id", () => {
		expect(shouldResumeTraktImport({ status: "running" })).toBe(false);
		expect(shouldResumeTraktImport({ id: "", status: "running" })).toBe(false);
	});
});

describe("extractErrorMessage", () => {
	it("joins NestJS validation arrays", () => {
		expect(
			extractErrorMessage({ message: ["code is required", "too short"] }, "x"),
		).toBe("code is required, too short");
	});

	it("returns a non-empty string message, including from Error instances", () => {
		expect(extractErrorMessage({ message: "Invalid code" }, "x")).toBe(
			"Invalid code",
		);
		expect(extractErrorMessage(new Error("boom"), "x")).toBe("boom");
	});

	it("falls back for empty, missing, or non-object errors", () => {
		expect(extractErrorMessage({ message: "" }, "fallback")).toBe("fallback");
		expect(extractErrorMessage({ message: 42 }, "fallback")).toBe("fallback");
		expect(extractErrorMessage({}, "fallback")).toBe("fallback");
		expect(extractErrorMessage(null, "fallback")).toBe("fallback");
		expect(extractErrorMessage("nope", "fallback")).toBe("fallback");
	});
});

describe("getResendLabel", () => {
	it("shows the cooldown even while a send is pending", () => {
		expect(getResendLabel(RESEND_COOLDOWN_SECONDS, false)).toBe(
			"Resend in 60s",
		);
		expect(getResendLabel(5, true)).toBe("Resend in 5s");
	});

	it("shows the pending state, then the idle label", () => {
		expect(getResendLabel(0, true)).toBe("Sending...");
		expect(getResendLabel(0, false)).toBe("Resend code");
	});
});

describe("resolveOnboardingCountry", () => {
	it("treats the US column default as unset and guesses instead", () => {
		const guess = vi.fn(() => "NL");
		expect(resolveOnboardingCountry("US", guess)).toBe("NL");
		expect(guess).toHaveBeenCalledOnce();
	});

	it("keeps any other saved country without guessing", () => {
		const guess = vi.fn(() => "NL");
		expect(resolveOnboardingCountry("DE", guess)).toBe("DE");
		expect(guess).not.toHaveBeenCalled();
	});
});

describe("buildDisplayNameUpdate", () => {
	it("skips the request when nothing changed", () => {
		expect(buildDisplayNameUpdate("Rowan", "Rowan")).toBeNull();
		expect(buildDisplayNameUpdate("", null)).toBeNull();
		expect(buildDisplayNameUpdate("", undefined)).toBeNull();
	});

	it("sends the new name", () => {
		expect(buildDisplayNameUpdate("Rowan", null)).toEqual({
			displayName: "Rowan",
		});
		expect(buildDisplayNameUpdate("R. P.", "Rowan")).toEqual({
			displayName: "R. P.",
		});
	});

	it("clears the name with undefined rather than an empty string", () => {
		expect(buildDisplayNameUpdate("", "Rowan")).toEqual({
			displayName: undefined,
		});
	});
});

describe("markOnboardingCompleted", () => {
	const user: UserDto = {
		did: "did:plc:test",
		handle: "rowan.opnshelf.social",
		displayName: "Rowan",
		avatar: null,
		onboardingCompletedAt: null,
		needsOnboarding: true,
		emailVerifiedAt: "2026-09-01T00:00:00.000Z",
		needsEmailVerification: false,
		blueskyProfileUrl: null,
		tangledProfileUrl: null,
		showBlueskyOnProfile: false,
		showTangledOnProfile: false,
	};

	it("leaves an empty cache alone", () => {
		expect(
			markOnboardingCompleted(undefined, "2026-09-05T10:00:00.000Z"),
		).toBeUndefined();
	});

	it("flips needsOnboarding and records the completion time without mutating", () => {
		const updated = markOnboardingCompleted(user, "2026-09-05T10:00:00.000Z");
		expect(updated).toEqual({
			...user,
			onboardingCompletedAt: "2026-09-05T10:00:00.000Z",
			needsOnboarding: false,
		});
		expect(user.needsOnboarding).toBe(true);
	});
});
