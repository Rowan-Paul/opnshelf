import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import WatchProviders from "./WatchProviders";

vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));

const tmdbLink = "https://www.themoviedb.org/tv/226698/watch?locale=NL";

function linksFor(providerId: number) {
	const html = renderToStaticMarkup(
		<WatchProviders
			country="NL"
			onCountryChange={() => {}}
			providers={{
				link: tmdbLink,
				flatrate: [
					{
						provider_id: providerId,
						provider_name: "Service",
						logo_path: "/logo.png",
						display_priority: 1,
					},
				],
			}}
		/>,
	);
	const element = document.createElement("div");
	element.innerHTML = html;
	return [...element.querySelectorAll("a")].map((link) => link.href);
}

describe("watch provider destinations", () => {
	it.each([
		[1899, "https://www.hbomax.com/"],
		[1825, "https://www.primevideo.com/"],
		[8, "https://www.netflix.com/"],
		[999999, tmdbLink],
	])("opens provider %s while preserving JustWatch attribution", (id, url) => {
		expect(linksFor(id)).toEqual([url, "https://www.justwatch.com/"]);
	});
});
