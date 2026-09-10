const SUPPRESSED_ROUTES = [
	"/login",
	"/signup",
	"/verify-email",
	"/onboarding",
	"/auth",
];

/**
 * Whether the "Update ready" banner stays hidden on `pathname`, even though
 * the update check keeps running underneath. The auth and onboarding screens
 * are suppressed: a restart there throws away a half-filled form or onboarding
 * progress, and a first-run user should not meet "restart the app" before
 * meeting the app. The downloaded update still applies on the next cold
 * launch.
 *
 * Routes match exactly or at a `/` segment boundary, so `/auth/complete` is
 * suppressed while a sibling such as `/login-help` would not be.
 */
export function isUpdateBannerSuppressed(pathname: string): boolean {
	return SUPPRESSED_ROUTES.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`),
	);
}
