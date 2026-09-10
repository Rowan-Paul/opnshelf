/**
 * Routes where the "Update ready" banner stays hidden even though the update
 * check keeps running underneath. These are the auth and onboarding screens: a
 * restart there throws away a half-filled form or onboarding progress, and a
 * first-run user should not meet "restart the app" before meeting the app. The
 * downloaded update still applies on the next cold launch.
 */
const SUPPRESSED_PREFIXES = [
	"/login",
	"/signup",
	"/verify-email",
	"/onboarding",
	"/auth/",
];

export function isUpdateBannerSuppressed(pathname: string): boolean {
	return SUPPRESSED_PREFIXES.some(
		(prefix) =>
			pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix),
	);
}
