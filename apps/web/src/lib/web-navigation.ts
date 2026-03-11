import { getProfileRoute, normalizeProfileHandle } from "@/lib/profile-routes";

export type GlobalNavItemId = "home" | "search" | "my-shelf";

export interface GlobalNavItem {
	id: GlobalNavItemId;
	label: string;
}

const SIGNED_OUT_PRIMARY_NAV: GlobalNavItem[] = [
	{ id: "home", label: "Home" },
	{ id: "search", label: "Search" },
];

const SIGNED_IN_PRIMARY_NAV: GlobalNavItem[] = [
	...SIGNED_OUT_PRIMARY_NAV,
	{ id: "my-shelf", label: "My Shelf" },
];

export function getSignedOutPrimaryNav() {
	return SIGNED_OUT_PRIMARY_NAV;
}

export function getSignedInPrimaryNav() {
	return SIGNED_IN_PRIMARY_NAV;
}

export function getHomeRoute() {
	return {
		to: "/" as const,
	};
}

export function getSearchRoute() {
	return {
		to: "/search" as const,
		search: { q: "", type: "all" as const },
	};
}

export function getMyShelfRoute(handle: string) {
	return getProfileRoute(handle, "shelf", { page: 1 });
}

export function getSettingsRoute(handle: string) {
	return getProfileRoute(handle, "settings");
}

export function isGlobalNavItemActive(
	itemId: GlobalNavItemId,
	pathname: string,
	currentUserHandle?: string | null,
) {
	switch (itemId) {
		case "home":
			return pathname === "/";
		case "search":
			return pathname === "/search";
		case "my-shelf": {
			if (!currentUserHandle) {
				return false;
			}

			const normalizedHandle = normalizeProfileHandle(currentUserHandle);
			return pathname.startsWith(`/profile/${normalizedHandle}/`);
		}
	}
}

export function shouldHideMobileBottomNav(pathname: string) {
	return (
		pathname === "/login" ||
		pathname === "/onboarding" ||
		pathname.startsWith("/auth/")
	);
}
