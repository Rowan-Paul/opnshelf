import { PostHogProvider as BasePostHogProvider } from "@posthog/react";
import posthog from "posthog-js";
import type { ReactNode } from "react";

// ponytail: every environment builds with the same VITE_POSTHOG_KEY, so the
// origin is the gate: only the live site reports. That keeps localhost and
// staging out of the production numbers without a second project or another
// env var. opnshelf.xyz is the only domain on the production service, so add
// any new one here too, or give staging its own key and drop this check.
const isProductionOrigin =
	typeof window !== "undefined" && window.location.hostname === "opnshelf.xyz";

export const isPostHogEnabled =
	Boolean(import.meta.env.VITE_POSTHOG_KEY) && isProductionOrigin;

if (isPostHogEnabled) {
	posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
		// Requests go through our origin so ad blockers are less likely to prevent
		// analytics from reaching PostHog. Nitro forwards this path to PostHog EU.
		api_host: "/ingest",
		person_profiles: "identified_only",
		capture_pageview: false,
		capture_pageleave: true,
		capture_performance: true,
		defaults: "2025-11-30",
		before_send: (event) => {
			if (!event) return event;
			// Custom event captures inherit browser URL fields by default. Dynamic
			// paths and query strings can contain user-generated identifiers or
			// credentials, so analytics uses explicit categorical properties instead.
			delete event.properties.$current_url;
			delete event.properties.$pathname;
			delete event.properties.$referrer;
			return event;
		},
	});
}

export { posthog };

interface PostHogProviderProps {
	children: ReactNode;
}

export default function PostHogProvider({ children }: PostHogProviderProps) {
	return <BasePostHogProvider client={posthog}>{children}</BasePostHogProvider>;
}
