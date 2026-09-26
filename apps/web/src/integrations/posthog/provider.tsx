import { preparePostHogEvent } from "@opnshelf/api";
import type { PostHog } from "posthog-js";

// ponytail: every environment builds with the same VITE_POSTHOG_KEY, so the
// origin is the gate: only the live site reports. That keeps localhost and
// staging out of the production numbers without a second project or another
// env var. opnshelf.xyz is the only domain on the production service, so add
// any new one here too, or give staging its own key and drop this check.
const isProductionOrigin =
	typeof window !== "undefined" && window.location.hostname === "opnshelf.xyz";

export const isPostHogEnabled =
	Boolean(import.meta.env.VITE_POSTHOG_KEY) && isProductionOrigin;

let client: PostHog | undefined;
const pending: Array<(client: PostHog) => void> = [];

function withClient(call: (client: PostHog) => void) {
	if (!isPostHogEnabled) return;
	if (client) call(client);
	else pending.push(call);
}

// posthog-js is roughly a quarter of the entry bundle, so it loads as its own
// chunk instead of blocking every first paint. Calls made before it arrives
// are queued and replayed in order once it is initialised.
export const posthogLoaded: Promise<void> | undefined = isPostHogEnabled
	? import("posthog-js").then(({ default: loaded }) => {
			loaded.init(import.meta.env.VITE_POSTHOG_KEY, {
				// Requests go through our origin so ad blockers are less likely to
				// prevent analytics from reaching PostHog. Nitro forwards this path to
				// PostHog EU.
				api_host: "/ingest",
				person_profiles: "identified_only",
				capture_pageview: false,
				capture_pageleave: true,
				capture_performance: true,
				defaults: "2025-11-30",
				before_send: (event) => {
					if (!event) return event;
					// The root route supplies only the origin and route section for
					// pageviews. Other events can inherit sensitive browser URLs.
					if (event.event !== "$pageview") {
						delete event.properties.$current_url;
						delete event.properties.$pathname;
					}
					delete event.properties.$referrer;
					return preparePostHogEvent(event);
				},
			});
			loaded.startExceptionAutocapture();
			client = loaded;
			for (const call of pending.splice(0)) call(loaded);
		})
	: undefined;

/** The subset of the PostHog client the app uses, safe to call before it loads. */
export const posthog = {
	capture: (...args: Parameters<PostHog["capture"]>) =>
		withClient((c) => c.capture(...args)),
	captureException: (...args: Parameters<PostHog["captureException"]>) =>
		withClient((c) => c.captureException(...args)),
	identify: (...args: Parameters<PostHog["identify"]>) =>
		withClient((c) => c.identify(...args)),
	reset: (...args: Parameters<PostHog["reset"]>) =>
		withClient((c) => c.reset(...args)),
};
