import type { SocialUserCardDto } from "@opnshelf/api";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PeopleSearch } from "./PeopleSearch";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

afterEach(cleanup);

it.each([
	null,
	undefined,
	"",
	"Alice",
])("renders the display name or handle in suggestions and search results (%s)", (displayName) => {
	// The generated client types nullable names as objects; the API returns strings.
	const person = {
		did: "did:plc:alice",
		handle: "alice.test",
		displayName,
		avatar: null,
		followersCount: 0,
		followingCount: 0,
		isFollowing: false,
		isFollowedBy: false,
	} as unknown as SocialUserCardDto;
	const props = {
		query: "",
		onQueryChange: vi.fn(),
		isSearching: true,
		onFocus: vi.fn(),
		onBlur: vi.fn(),
		results: [person],
		isLoading: false,
		suggestions: [person],
		isSuggestionsLoading: false,
		onFollow: vi.fn(),
		onUnfollow: vi.fn(),
	};
	const { rerender } = render(<PeopleSearch {...props} />);
	expect(screen.getByText(displayName || person.handle)).toBeDefined();
	rerender(<PeopleSearch {...props} query="alice" />);
	expect(screen.getByText(displayName || person.handle)).toBeDefined();
});
