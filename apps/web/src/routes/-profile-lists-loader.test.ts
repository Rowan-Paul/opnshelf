import { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

const viewer = vi.hoisted(() => ({
	cannotIdentify: false,
	fetch: undefined as typeof globalThis.fetch | undefined,
}));

vi.mock("#/lib/session-hint", async (importOriginal) => ({
	...(await importOriginal<typeof import("#/lib/session-hint")>()),
	ssrCannotIdentifyViewer: () => viewer.cannotIdentify,
}));

vi.mock("#/lib/api", async (importOriginal) => ({
	...(await importOriginal<typeof import("#/lib/api")>()),
	ssrAuthOptions: () => (viewer.fetch ? { fetch: viewer.fetch } : {}),
}));

import { Route } from "./profile.$handle/lists.index";

const profile = { did: "did:plc:owner", handle: "owner.test" };

async function runLoader() {
	const queryClient = new QueryClient();
	const ensureQueryData = vi
		.spyOn(queryClient, "ensureQueryData")
		.mockResolvedValueOnce(profile)
		.mockResolvedValueOnce([]);
	const loader = Route.options.loader;
	if (typeof loader !== "function") throw new Error("Expected lists loader");
	const result = await loader({
		context: { queryClient },
		params: { handle: profile.handle },
	} as Parameters<typeof loader>[0]);
	queryClient.clear();
	return { ensureQueryData, result };
}

afterEach(() => {
	viewer.cannotIdentify = false;
	viewer.fetch = undefined;
});

it("leaves the Lists to the browser when SSR cannot tell who is asking", async () => {
	viewer.cannotIdentify = true;
	const { ensureQueryData, result } = await runLoader();
	expect(ensureQueryData).toHaveBeenCalledTimes(1);
	expect(result).toEqual({ profile });
});

it("fetches the Lists with the viewer's session under the browser's query key", async () => {
	viewer.fetch = vi.fn() as unknown as typeof globalThis.fetch;
	const { ensureQueryData } = await runLoader();
	const withSession = ensureQueryData.mock.calls[1]?.[0];
	expect(JSON.stringify(withSession?.queryKey)).toContain(profile.did);

	viewer.fetch = undefined;
	const anonymous = (await runLoader()).ensureQueryData.mock.calls[1]?.[0];
	expect(withSession?.queryKey).toEqual(anonymous?.queryKey);
});
