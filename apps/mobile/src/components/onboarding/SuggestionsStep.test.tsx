import {
	QueryClient,
	QueryClientProvider,
	useQuery,
} from "@tanstack/react-query";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SuggestionsStep } from "./SuggestionsStep";

const api = vi.hoisted(() => ({ search: vi.fn(), toggle: vi.fn() }));
vi.mock("@opnshelf/api", () => ({
	socialControllerSearchPeopleInfiniteOptions: ({
		query,
	}: {
		query: { q: string };
	}) => ({
		queryKey: ["search", query.q],
		queryFn: ({ pageParam }: { pageParam: number }) =>
			api.search(query.q, pageParam),
	}),
}));
vi.mock("react-native", () => ({ View: "view", Pressable: "pressable" }));
vi.mock("@/components/ui/text", () => ({ Text: "text" }));
vi.mock("@/components/ui/text-field", async () => {
	const { createElement } = await import("react");
	return {
		TextField: (props: { trailing?: import("react").ReactNode }) =>
			createElement("text-field", props, props.trailing),
	};
});
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/ui/skeletons", () => ({ UserRowsSkeleton: "skeleton" }));
vi.mock("@/components/social/UserRow", () => ({ UserRow: "user-row" }));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ user: { did: "self" } }),
}));
vi.mock("@/lib/use-social", () => ({
	useFollowToggle: () => ({ toggle: api.toggle }),
	useSuggestions: (enabled: boolean) =>
		useQuery({
			queryKey: ["suggestions"],
			queryFn: async () => ({
				items: [{ did: "suggested", displayName: "Suggested" }],
			}),
			enabled,
		}),
}));
let tree: ReactTestRenderer;
const pause = async () => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 400));
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 10));
	});
};
const rows = () =>
	tree.root.findAll((node) => String(node.type) === "user-row");
const field = () =>
	tree.root.find((node) => String(node.type) === "text-field");
beforeEach(async () => {
	vi.resetAllMocks();
	api.search.mockImplementation(async (_query, page) => ({
		items: [{ did: `person-${page}`, displayName: `Person ${page}` }],
		page,
		hasNextPage: page === 1,
	}));
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	await act(async () => {
		tree = create(
			<QueryClientProvider client={client}>
				<SuggestionsStep onFollowed={vi.fn()} />
			</QueryClientProvider>,
		);
	});
	await pause();
});
afterEach(async () => {
	await act(async () => tree.unmount());
});
it("debounces trimmed searches, appends pages, routes follows and restores suggestions on clear", async () => {
	expect(rows()[0].props.user.did).toBe("suggested");
	expect(api.search).not.toHaveBeenCalled();
	await act(async () => field().props.onChangeText("  ali  "));
	expect(api.search).not.toHaveBeenCalled();
	await pause();
	expect(api.search).toHaveBeenCalledWith("ali", 1);
	expect(rows()[0].props.user.did).toBe("person-1");
	await act(async () =>
		tree.root.findByProps({ label: "Load more" }).props.onPress(),
	);
	await pause();
	expect(rows()).toHaveLength(2);
	await act(async () => rows()[0].props.onToggleFollow("person-1", false));
	expect(api.toggle).toHaveBeenCalledWith("person-1", false);
	await act(async () =>
		tree.root
			.findByProps({ accessibilityLabel: "Clear search" })
			.props.onPress(),
	);
	expect(rows()[0].props.user.did).toBe("suggested");
});
it("shows a search error, retries and handles empty results", async () => {
	api.search.mockRejectedValueOnce(new Error("offline"));
	await act(async () => field().props.onChangeText("nobody"));
	await pause();
	expect(
		tree.root
			.findAll((node) => node.type === "text")
			.map((node) => node.props.children)
			.join(" "),
	).toContain("Couldn't search people.");
	api.search.mockResolvedValue({ items: [], page: 1, hasNextPage: false });
	await act(async () =>
		tree.root.findByProps({ label: "Try again" }).props.onPress(),
	);
	await pause();
	expect(
		tree.root
			.findAll((node) => node.type === "text")
			.map((node) => node.props.children)
			.join(" "),
	).toContain("No people found. Try another name or handle.");
});
