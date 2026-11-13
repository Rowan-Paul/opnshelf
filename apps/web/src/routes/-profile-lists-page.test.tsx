import { listsControllerGetPublicUserListsQueryKey } from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SIGNED_IN_HINT_QUERY_KEY } from "#/lib/session-hint";

const did = "did:plc:owner";

vi.mock("@opnshelf/api", async (importOriginal) => ({
	...(await importOriginal<typeof import("@opnshelf/api")>()),
	usersControllerGetPublicProfileOptions: () => ({
		queryKey: ["profile"],
		queryFn: async () => ({ did, handle: "owner.test" }),
	}),
}));
vi.mock("#/lib/auth-context", () => ({ useAuth: () => ({ user: { did } }) }));
vi.mock("#/components/profile/ProfileListsOverview", () => ({
	ProfileListsOverview: () => null,
}));

import { Route } from "./profile.$handle/lists.index";

function renderOwnerPage(ssrSawSignedInHint: boolean) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { staleTime: 60_000 } },
	});
	const listsKey = listsControllerGetPublicUserListsQueryKey({
		path: { userDid: did },
	});
	queryClient.setQueryData(["profile"], { did, handle: "owner.test" });
	queryClient.setQueryData(SIGNED_IN_HINT_QUERY_KEY, ssrSawSignedInHint);
	queryClient.setQueryData(listsKey, []);
	vi.spyOn(Route, "useParams").mockReturnValue({ handle: "owner.test" });
	const Page = Route.options.component;
	if (!Page) throw new Error("Expected lists page");
	render(
		<QueryClientProvider client={queryClient}>
			<Page />
		</QueryClientProvider>,
	);
	return () => queryClient.getQueryState(listsKey)?.isInvalidated;
}

it("asks for the owner's Lists again when SSR rendered them for a signed-out visitor", async () => {
	const isInvalidated = renderOwnerPage(false);
	await waitFor(() => expect(isInvalidated()).toBe(true));
});

it("keeps the hydrated Lists when SSR knew the visitor may be signed in", async () => {
	const isInvalidated = renderOwnerPage(true);
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(isInvalidated()).toBe(false);
});
