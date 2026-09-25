import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FollowSuggestionsStep } from "./FollowSuggestionsStep";

const api = vi.hoisted(() => ({
	search: vi.fn(),
	suggestions: vi.fn(),
	follow: vi.fn(),
}));
vi.mock("@opnshelf/api", () => ({
	socialControllerGetSuggestionsOptions: () => ({
		queryKey: [{ _id: "suggestions" }],
		queryFn: api.suggestions,
	}),
	socialControllerSearchPeopleInfiniteOptions: ({
		query,
	}: {
		query: { q: string };
	}) => ({
		queryKey: [{ _id: "socialControllerSearchPeople", q: query.q }],
		queryFn: ({ pageParam }: { pageParam: number }) =>
			api.search(query.q, pageParam),
	}),
	socialControllerFollowMutation: () => ({ mutationFn: api.follow }),
}));
vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const person = (name: string, following = false) => ({
	did: `did:plc:${name}`,
	handle: `${name}.test`,
	displayName: name,
	isFollowing: following,
});
function setup() {
	const onNext = vi.fn();
	const onFollowed = vi.fn();
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<FollowSuggestionsStep onNext={onNext} onFollowed={onFollowed} />
		</QueryClientProvider>,
	);
	return { onNext, onFollowed };
}
beforeEach(() => {
	vi.resetAllMocks();
	api.suggestions.mockResolvedValue({ items: [person("Suggested")] });
	api.search.mockImplementation(async (_query, page) => ({
		items: [person(page === 1 ? "Alice" : "Alison")],
		page,
		hasNextPage: page === 1,
	}));
	api.follow.mockResolvedValue({});
});
afterEach(cleanup);

it("searches after debouncing, loads another page, follows a result and clears back to suggestions", async () => {
	const { onNext, onFollowed } = setup();
	await screen.findByText("Suggested");
	expect(api.search).not.toHaveBeenCalled();
	fireEvent.change(screen.getByRole("searchbox"), {
		target: { value: "  ali  " },
	});
	expect(api.search).not.toHaveBeenCalled();
	await screen.findByText("Alice");
	expect(api.search).toHaveBeenCalledWith("ali", 1);
	fireEvent.click(screen.getByRole("button", { name: "Load more" }));
	await screen.findByText("Alison");
	expect(screen.getByText("Alice")).toBeTruthy();
	api.search.mockImplementation(async (_query, page) => ({
		items: [person(page === 1 ? "Alice" : "Alison", page === 1)],
		page,
		hasNextPage: page === 1,
	}));
	fireEvent.click(screen.getAllByRole("button", { name: "Follow" })[0]);
	await screen.findByText("Following");
	expect(api.follow.mock.calls[0][0]).toEqual({
		path: { targetDid: "did:plc:Alice" },
	});
	expect(onFollowed).toHaveBeenCalledOnce();
	fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
	expect(screen.getByText("Suggested")).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Continue" }));
	expect(onNext).toHaveBeenCalledOnce();
});

it("shows a retryable search error and an empty result without blocking Continue", async () => {
	api.search.mockRejectedValueOnce(new Error("offline"));
	const { onNext } = setup();
	fireEvent.change(screen.getByRole("searchbox"), {
		target: { value: "nobody" },
	});
	await screen.findByText("Couldn't search people.");
	api.search.mockResolvedValue({ items: [], page: 1, hasNextPage: false });
	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	await screen.findByText("No people found. Try another name or handle.");
	fireEvent.click(screen.getByRole("button", { name: "Continue" }));
	expect(onNext).toHaveBeenCalledOnce();
});

it("keeps loaded results visible while another search is in flight", async () => {
	setup();
	fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ali" } });
	await screen.findByText("Alice");
	api.search.mockImplementation(() => new Promise(() => {}));
	fireEvent.change(screen.getByRole("searchbox"), { target: { value: "bob" } });
	await waitFor(() => expect(api.search).toHaveBeenCalledWith("bob", 1));
	expect(screen.getByText("Alice")).toBeTruthy();
	expect(
		screen
			.queryByRole("button", { name: "Load more" })
			?.hasAttribute("disabled") ?? true,
	).toBe(true);
});
