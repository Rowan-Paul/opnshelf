import {
	notesControllerGetUserNotesInfiniteQueryKey,
	notesControllerGetUserNotesQueryKey,
} from "@opnshelf/api";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { invalidateUserNotesQueries } from "./use-note";

vi.mock("expo-haptics", () => ({
	ImpactFeedbackStyle: { Light: "light" },
	NotificationFeedbackType: { Success: "success" },
	impactAsync: vi.fn(),
	notificationAsync: vi.fn(),
}));

vi.mock("@/components/ui/toast", () => ({
	useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true, user: { did: "did:plc:viewer" } }),
}));

describe("invalidateUserNotesQueries", () => {
	it("invalidates the user's paginated and infinite note collections only", async () => {
		const client = new QueryClient();
		const pageKey = notesControllerGetUserNotesQueryKey({
			path: { userDid: "did:plc:viewer" },
			query: { limit: 10, cursor: "page-2" },
		});
		const infiniteKey = notesControllerGetUserNotesInfiniteQueryKey({
			path: { userDid: "did:plc:viewer" },
			query: { limit: 20 },
		});
		const otherUserKey = notesControllerGetUserNotesQueryKey({
			path: { userDid: "did:plc:other" },
		});
		client.setQueryData(pageKey, { items: [] });
		client.setQueryData(infiniteKey, { pages: [], pageParams: [] });
		client.setQueryData(otherUserKey, { items: [] });

		await invalidateUserNotesQueries(client, "did:plc:viewer");

		expect(client.getQueryState(pageKey)?.isInvalidated).toBe(true);
		expect(client.getQueryState(infiniteKey)?.isInvalidated).toBe(true);
		expect(client.getQueryState(otherUserKey)?.isInvalidated).toBe(false);
	});
});
