import type { FollowedWatchersDto } from "@opnshelf/api";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import { FriendWatchersRow } from "./FriendWatchersRow";

describe("FriendWatchersRow", () => {
	it("renders watcher avatars and an overflow badge", () => {
		const watchers: FollowedWatchersDto = {
			total: 5,
			pageSize: 8,
			items: [
				{
					actor: {
						did: "did:plc:friend-1",
						handle: "friend-1.bsky.social",
						displayName: "Friend One",
						avatar: "https://example.com/friend-1.jpg",
					},
					activityAt: "2026-03-03T12:00:00.000Z",
				},
				{
					actor: {
						did: "did:plc:friend-2",
						handle: "friend-2.bsky.social",
						displayName: "Friend Two",
						avatar: "https://example.com/friend-2.jpg",
					},
					activityAt: "2026-03-02T12:00:00.000Z",
				},
				{
					actor: {
						did: "did:plc:friend-3",
						handle: "friend-3.bsky.social",
						displayName: "Friend Three",
						avatar: "https://example.com/friend-3.jpg",
					},
					activityAt: "2026-03-01T12:00:00.000Z",
				},
			],
		};

		const markup = renderToStaticMarkup(
			<ThemeProvider>
				<FriendWatchersRow
					watchers={watchers}
					colors={{
						primary: "#f59e0b",
						secondary: "#d97706",
						accent: "#fbbf24",
						muted: "#92400e",
					}}
				/>
			</ThemeProvider>,
		);

		expect(markup).toContain("Friend Activity");
		expect(markup).toContain("+2");
		expect(markup).toContain("friend-1.jpg");
		expect(markup).toContain("friend-2.jpg");
		expect(markup).toContain("friend-3.jpg");
	});

	it("falls back to initials when a watcher has no avatar", () => {
		const watchers: FollowedWatchersDto = {
			total: 1,
			pageSize: 8,
			items: [
				{
					actor: {
						did: "did:plc:friend-1",
						handle: "friend-1.bsky.social",
						displayName: "Friend One",
						avatar: null,
					},
					activityAt: "2026-03-03T12:00:00.000Z",
				},
			],
		};

		const markup = renderToStaticMarkup(
			<ThemeProvider>
				<FriendWatchersRow
					watchers={watchers}
					colors={{
						primary: "#f59e0b",
						secondary: "#d97706",
						accent: "#fbbf24",
						muted: "#92400e",
					}}
				/>
			</ThemeProvider>,
		);

		expect(markup).toContain(">F<");
		expect(markup).toContain("/profile/friend-1.bsky.social/shelf?page=1");
	});

	it("renders nothing when there are no followed watchers", () => {
		const markup = renderToStaticMarkup(
			<ThemeProvider>
				<FriendWatchersRow
					watchers={{ items: [], pageSize: 8, total: 0 }}
					colors={{
						primary: "#f59e0b",
						secondary: "#d97706",
						accent: "#fbbf24",
						muted: "#92400e",
					}}
				/>
			</ThemeProvider>,
		);

		expect(markup).toBe("");
	});

	it("omits the overflow badge when every watcher is visible", () => {
		const watchers: FollowedWatchersDto = {
			total: 2,
			pageSize: 8,
			items: [
				{
					actor: {
						did: "did:plc:friend-1",
						handle: "friend-1.bsky.social",
						displayName: "Friend One",
						avatar: "https://example.com/friend-1.jpg",
					},
					activityAt: "2026-03-03T12:00:00.000Z",
				},
				{
					actor: {
						did: "did:plc:friend-2",
						handle: "friend-2.bsky.social",
						displayName: "Friend Two",
						avatar: "https://example.com/friend-2.jpg",
					},
					activityAt: "2026-03-02T12:00:00.000Z",
				},
			],
		};

		const markup = renderToStaticMarkup(
			<ThemeProvider>
				<FriendWatchersRow
					watchers={watchers}
					colors={{
						primary: "#f59e0b",
						secondary: "#d97706",
						accent: "#fbbf24",
						muted: "#92400e",
					}}
				/>
			</ThemeProvider>,
		);

		expect(markup).not.toContain("+1");
		expect(markup).not.toContain("+2");
	});
});
