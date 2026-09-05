import {
	isKnownTraktImportStatus,
	isTerminalTraktImportStatus,
	type UserDto,
} from "@opnshelf/api";

/**
 * Pure step ordering and derived-state helpers for the onboarding route. The
 * route owns the mutations and rendering; this module owns the decisions.
 */

export const ONBOARDING_STEPS = [
	"welcome",
	"profile",
	"preferences",
	"trakt",
	"suggestions",
	"watched",
	"done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isOnboardingStep(value: unknown): value is OnboardingStep {
	return ONBOARDING_STEPS.includes(value as OnboardingStep);
}

/** The step after `step`; the final step stays put. */
export function nextOnboardingStep(step: OnboardingStep): OnboardingStep {
	const index = ONBOARDING_STEPS.indexOf(step);
	return ONBOARDING_STEPS[Math.min(index + 1, ONBOARDING_STEPS.length - 1)];
}

/**
 * Whether a returning user should land on the Trakt step: only when the
 * server reports a job that is known and still in flight. `null` means no job.
 */
export function shouldResumeTraktImport(
	job: { id?: string; status: string } | null | undefined,
): boolean {
	return Boolean(
		job?.id &&
			isKnownTraktImportStatus(job.status) &&
			!isTerminalTraktImportStatus(job.status),
	);
}

export const RESEND_COOLDOWN_SECONDS = 60;

/** Pull a human-readable message out of a NestJS error body (string or string[]). */
export function extractErrorMessage(error: unknown, fallback: string): string {
	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		if (Array.isArray(message)) return message.join(", ");
		if (typeof message === "string" && message.length > 0) return message;
	}
	return fallback;
}

/** Label for the resend-code button: cooldown wins over the pending state. */
export function getResendLabel(cooldown: number, isPending: boolean): string {
	if (cooldown > 0) return `Resend in ${cooldown}s`;
	return isPending ? "Sending..." : "Resend code";
}

/**
 * "US" is the column default, so during onboarding it means "never picked" far
 * more often than "picked the US" — guess from the browser instead.
 */
export function resolveOnboardingCountry(
	watchCountry: string,
	guess: () => string,
): string {
	return watchCountry === "US" ? guess() : watchCountry;
}

/**
 * The profile update to send when the user continues past the profile step, or
 * `null` when the display name is unchanged. Clearing the field sends
 * `undefined` so the API unsets it.
 */
export function buildDisplayNameUpdate(
	displayName: string,
	currentDisplayName: string | null | undefined,
): { displayName: string | undefined } | null {
	if (displayName === (currentDisplayName ?? "")) return null;
	return { displayName: displayName || undefined };
}

/** Optimistic /auth/me cache update once onboarding has been completed. */
export function markOnboardingCompleted(
	old: UserDto | undefined,
	onboardingCompletedAt: string | null,
): UserDto | undefined {
	if (!old) return old;
	return {
		...old,
		onboardingCompletedAt,
		needsOnboarding: false,
	};
}
