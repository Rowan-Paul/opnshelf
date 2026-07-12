import { PostHogProvider as BasePostHogProvider } from "@posthog/react";
import posthog from "posthog-js";
import type { ReactNode } from "react";

export const isPostHogEnabled = Boolean(import.meta.env.VITE_POSTHOG_KEY);

if (typeof window !== "undefined" && isPostHogEnabled) {
	posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
		api_host: import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
		person_profiles: "identified_only",
		capture_pageview: false,
		defaults: "2025-11-30",
	});
}

export { posthog };

interface PostHogProviderProps {
	children: ReactNode;
}

export default function PostHogProvider({ children }: PostHogProviderProps) {
	return <BasePostHogProvider client={posthog}>{children}</BasePostHogProvider>;
}
