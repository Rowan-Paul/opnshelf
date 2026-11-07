import { useSearchAnalytics } from "@opnshelf/api/analytics-react";
import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";

it("counts completed query/tab visits without placeholders, refetches or pagination", () => {
	const capture = vi.fn();
	const initial = {
		query: "one",
		tab: "all",
		surface: "search",
		resultCount: 3,
		ready: false,
		page: 1,
		capture,
	};
	const { rerender } = renderHook((props) => useSearchAnalytics(props), {
		initialProps: initial,
	});
	expect(capture).not.toHaveBeenCalled();
	rerender({ ...initial, ready: true });
	rerender({ ...initial, ready: true, resultCount: 4 });
	rerender({ ...initial, ready: true, page: 2, resultCount: 20 });
	expect(capture).toHaveBeenCalledTimes(1);
	rerender({ ...initial, query: "two", ready: false });
	expect(capture).toHaveBeenCalledTimes(1);
	rerender({ ...initial, query: "two", ready: true, resultCount: 0 });
	expect(capture).toHaveBeenCalledTimes(2);
	expect(capture).toHaveBeenLastCalledWith("search_performed", {
		surface: "search",
		tab: "all",
		query_length: 3,
		result_count: 0,
	});
	expect(JSON.stringify(capture.mock.calls)).not.toMatch(/one|two/);
	rerender({ ...initial, query: "two", tab: "cast", ready: true });
	expect(capture).toHaveBeenCalledTimes(3);
});
