import type { ParsedLocation } from "@tanstack/react-router";

/**
 * Scroll restoration key (ADR 0032). Social keeps its feed position for the
 * session, keyed by URL rather than by history entry, so returning from Find
 * people or Circles restores where the reader left off, the same way the
 * Mobile tab stays mounted. Other pages keep TanStack's default per-entry key.
 *
 * `/social/` and `/social` must share a key: a direct load can keep the
 * trailing slash while supporting pages navigate back to `/social`.
 */
export function getScrollRestorationKey(location: ParsedLocation): string {
	const pathname = location.pathname.replace(/\/+$/, "") || "/";
	if (pathname === "/social") {
		return location.href.replace(/\/+(?=[?#]|$)/, "");
	}
	return location.state.__TSR_key ?? location.href;
}
