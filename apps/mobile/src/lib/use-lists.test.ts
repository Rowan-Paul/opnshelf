import {
	listsControllerGetPublicUserListQueryKey,
	listsControllerGetPublicUserListsQueryKey,
} from "@opnshelf/api";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { invalidatePublicListQueries } from "./use-lists";

vi.mock("expo-haptics", () => ({
	ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
	impactAsync: vi.fn(),
}));

vi.mock("@/components/ui/toast", () => ({
	useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true, user: { did: "did:plc:viewer" } }),
}));

vi.mock("@/lib/posthog", () => ({ posthog: undefined }));

describe("invalidatePublicListQueries", () => {
	it("invalidates the owner's summary and every cached variant of that list", async () => {
		const client = new QueryClient();
		const summaryKey = listsControllerGetPublicUserListsQueryKey({
			path: { userDid: "did:plc:viewer" },
		});
		const detailKey = listsControllerGetPublicUserListQueryKey({
			path: { userDid: "did:plc:viewer", slug: "watchlist" },
			query: { sort: "title" },
		});
		const otherUserKey = listsControllerGetPublicUserListsQueryKey({
			path: { userDid: "did:plc:other" },
		});
		client.setQueryData(summaryKey, []);
		client.setQueryData(detailKey, { items: [] });
		client.setQueryData(otherUserKey, []);

		await invalidatePublicListQueries(client, "did:plc:viewer", "watchlist");

		expect(client.getQueryState(summaryKey)?.isInvalidated).toBe(true);
		expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
		expect(client.getQueryState(otherUserKey)?.isInvalidated).toBe(false);
	});
});
