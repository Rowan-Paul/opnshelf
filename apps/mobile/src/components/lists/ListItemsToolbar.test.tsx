import type { MediaInListDto } from "@opnshelf/api";
import { createElement, type PropsWithChildren } from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import {
	filterListItems,
	ListItemsToolbar,
	useListItemsFilter,
} from "./ListItemsToolbar";

function host(name: string) {
	return ({ children, ...props }: PropsWithChildren) =>
		createElement(name, props, children);
}
vi.mock("react-native", () => ({
	Pressable: host("Pressable"),
	View: host("View"),
}));
vi.mock("lucide-react-native", () => ({
	ArrowUpDown: () => null,
	Search: () => null,
	X: () => null,
}));
vi.mock("@/components/ui/text", () => ({ Text: host("Text") }));
vi.mock("@/components/ui/text-field", () => ({ TextField: host("TextField") }));
vi.mock("@/lib/use-debounce", () => ({
	useDebounce: (value: string) => value,
}));

const item = (overrides: Partial<MediaInListDto>) =>
	({
		id: overrides.mediaId ?? "id",
		mediaId: "1",
		mediaType: "movie",
		watched: false,
		media: {},
		...overrides,
	}) as MediaInListDto;

const items = [
	item({ mediaId: "1", media: { title: "Alien" } }),
	item({ mediaId: "2", media: { title: "Arrival" }, watched: true }),
	item({ mediaId: "3", mediaType: "show", media: { name: "Severance" } }),
	item({
		mediaId: "4",
		mediaType: "episode",
		media: { name: "Lost" },
		episodeName: "Pilot",
	}),
];
const ids = (list: MediaInListDto[]) => list.map((i) => i.mediaId);

describe("filterListItems", () => {
	it("keeps movies, or shows with their seasons and episodes", () => {
		expect(ids(filterListItems(items, "movie", ""))).toEqual(["1", "2"]);
		expect(ids(filterListItems(items, "show", ""))).toEqual(["3", "4"]);
	});

	it("drops watched items under Unwatched", () => {
		expect(ids(filterListItems(items, "unwatched", ""))).toEqual([
			"1",
			"3",
			"4",
		]);
	});

	it("searches titles and episode names, case-insensitively", () => {
		expect(ids(filterListItems(items, "all", " ALI "))).toEqual(["1"]);
		expect(ids(filterListItems(items, "all", "pilot"))).toEqual(["4"]);
	});
});

describe("useListItemsFilter", () => {
	it("loads the remaining pages while a search is active", () => {
		const fetchNextPage = vi.fn();
		let state: ReturnType<typeof useListItemsFilter> | undefined;
		function Probe() {
			state = useListItemsFilter(items, {
				hasNextPage: true,
				isFetchingNextPage: false,
				fetchNextPage,
			});
			return null;
		}
		act(() => {
			create(<Probe />);
		});
		expect(fetchNextPage).not.toHaveBeenCalled();
		expect(state?.isFiltered).toBe(false);

		act(() => state?.setSearch("sev"));
		expect(fetchNextPage).toHaveBeenCalled();
		expect(state?.isFiltered).toBe(true);
		expect(ids(state?.filteredItems ?? [])).toEqual(["3"]);
	});
});

describe("ListItemsToolbar", () => {
	it("renders owner-only controls only when passed in", () => {
		const props = {
			search: "",
			onSearchChange: vi.fn(),
			sort: "position" as const,
			onSortPress: vi.fn(),
			filter: "all" as const,
			onFilterChange: vi.fn(),
		};
		let visitor: ReturnType<typeof create> | undefined;
		let owner: ReturnType<typeof create> | undefined;
		act(() => {
			visitor = create(<ListItemsToolbar {...props} />);
			owner = create(<ListItemsToolbar {...props} trailing={<Reorder />} />);
		});
		expect(visitor?.root.findAllByType(Reorder)).toHaveLength(0);
		expect(owner?.root.findAllByType(Reorder)).toHaveLength(1);
		// Sort pill + four filter pills, for every viewer.
		expect(
			visitor?.root.findAll((node) => String(node.type) === "Pressable"),
		).toHaveLength(5);
	});
});

function Reorder() {
	return null;
}
