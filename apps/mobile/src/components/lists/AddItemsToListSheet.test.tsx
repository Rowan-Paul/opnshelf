import { createElement, type PropsWithChildren } from "react";
import { Pressable } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { AddItemsToListSheet } from "./AddItemsToListSheet";

const mocks = vi.hoisted(() => ({
	add: vi.fn(),
	remove: vi.fn(),
	queries: [] as { enabled: boolean }[],
}));
function host(name: string) {
	return ({ children, ...props }: PropsWithChildren) =>
		createElement(name, props, children);
}
vi.mock("react-native", () => ({
	Modal: host("Modal"),
	Pressable: host("Pressable"),
	View: host("View"),
}));
vi.mock("lucide-react-native", () => ({
	Check: () => null,
	Plus: () => null,
	Search: () => null,
	SearchX: () => null,
	X: () => null,
}));
vi.mock("@shopify/flash-list", () => ({
	FlashList: ({
		data,
		renderItem,
	}: {
		data: unknown[];
		renderItem: (input: { item: unknown }) => React.ReactNode;
	}) =>
		data.map((item, index) =>
			createElement("Row", { key: index }, renderItem({ item })),
		),
}));
vi.mock("@/components/media/PosterImage", () => ({ PosterImage: () => null }));
vi.mock("@/components/ui/text", () => ({ Text: host("Text") }));
vi.mock("@/components/ui/text-field", () => ({ TextField: host("TextField") }));
vi.mock("@/components/ui/button", () => ({ Button: host("Button") }));
vi.mock("@/components/ui/states", () => ({ ErrorState: host("ErrorState") }));
vi.mock("@/lib/posthog", () => ({ posthog: null }));
vi.mock("@/lib/use-debounce", () => ({
	useDebounce: (value: string) => value,
}));
vi.mock("@/lib/use-lists", () => ({
	useAddListItem: () => ({ mutate: mocks.add, isPending: false }),
	useRemoveListItem: () => ({ mutate: mocks.remove }),
}));
vi.mock("@tanstack/react-query", () => ({
	queryOptions: (options: unknown) => options,
	useQuery: (options: { queryKey: { _id: string }[]; enabled: boolean }) => {
		mocks.queries.push(options);
		const endpoint = options.queryKey[0]._id;
		return {
			data: !options.enabled
				? undefined
				: endpoint === "searchControllerSearchAll"
					? {
							items: [
								{
									id: 1,
									media_type: "movie",
									title: "Dune",
									release_date: "2021-01-01",
								},
							],
						}
					: endpoint === "showsControllerGetShowDetails"
						? { name: "Severance", first_air_date: "2022-01-01" }
						: { title: "Dune", release_date: "2021-01-01" },
			isLoading: false,
			isError: false,
		};
	},
}));
let view: ReactTestRenderer;
async function render(input: string, existingKeys = new Set<string>()) {
	await act(async () => {
		view = create(
			<AddItemsToListSheet
				visible
				onDismiss={() => {}}
				slug="watchlist"
				existingKeys={existingKeys}
				initialInput={input}
				confirmBeforeAdd
			/>,
		);
	});
}
function addRow() {
	return view.root.findAll(
		(node) =>
			node.type === Pressable &&
			String(node.props.accessibilityLabel).startsWith("Add "),
	)[0];
}
function button(label: string) {
	return view.root.findAll(
		(node) => node.type === Button && node.props.label === label,
	)[0];
}
beforeEach(() => {
	mocks.add.mockReset();
	mocks.remove.mockReset();
	mocks.queries = [];
});
describe("Shortcut watchlist confirmation", () => {
	it("searching and selecting cannot write; cancelling the confirmation cannot write", async () => {
		await render("Dune");
		expect(mocks.add).not.toHaveBeenCalled();
		await act(async () => addRow().props.onPress());
		expect(button("Add to Watchlist")).toBeDefined();
		expect(mocks.add).not.toHaveBeenCalled();
		await act(async () => button("Cancel").props.onPress());
		expect(mocks.add).not.toHaveBeenCalled();
		expect(mocks.remove).not.toHaveBeenCalled();
	});
	it("requires confirmation and blocks duplicate submission without optimistic removal", async () => {
		await render("Dune");
		await act(async () => addRow().props.onPress());
		const confirm = button("Add to Watchlist");
		await act(async () => {
			confirm.props.onPress();
			confirm.props.onPress();
		});
		expect(mocks.add).toHaveBeenCalledOnce();
		expect(mocks.add.mock.calls[0][0]).toEqual({
			path: { slug: "watchlist" },
			body: { mediaType: "movie", mediaId: "1" },
		});
		await act(async () => {
			mocks.add.mock.calls[0][1].onSuccess();
			mocks.add.mock.calls[0][1].onSettled();
		});
		expect(
			view.root.findAll(
				(node) =>
					node.type === Pressable &&
					node.props.accessibilityLabel === "Already added",
			)[0].props.disabled,
		).toBe(true);
		expect(mocks.remove).not.toHaveBeenCalled();
	});
	it("resolves a shared link by its ID and type before asking to add", async () => {
		await render("https://opnshelf.xyz/shows/95396/severance");
		await act(async () => addRow().props.onPress());
		await act(async () => button("Add to Watchlist").props.onPress());
		expect(mocks.add.mock.calls[0][0]).toEqual({
			path: { slug: "watchlist" },
			body: { mediaType: "show", mediaId: "95396" },
		});
	});
	it("does not remove an existing watchlist entry", async () => {
		await render("Dune", new Set(["movie:1"]));
		const row = view.root.findAll(
			(node) =>
				node.type === Pressable &&
				node.props.accessibilityLabel === "Already added",
		)[0];
		expect(row.props.disabled).toBe(true);
		await act(async () => row.props.onPress());
		expect(mocks.add).not.toHaveBeenCalled();
		expect(mocks.remove).not.toHaveBeenCalled();
	});
});
