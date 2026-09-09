import {
	notesControllerGetUserNotesInfiniteQueryKey,
	notesControllerGetUserNotesQueryKey,
} from "@opnshelf/api";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { invalidateUserNotesQueries } from "./useNotes";

describe("invalidateUserNotesQueries", () => {
	it("invalidates the affected user's paginated and infinite note collections", async () => {
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
