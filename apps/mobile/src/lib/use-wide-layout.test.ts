import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaCardColumns } from "./use-media-card-columns";
import { usePaneWidth, useWideLayout } from "./use-wide-layout";

const viewport = vi.hoisted(() => ({
	width: 951,
	fontScale: 1,
	left: 0,
	right: 0,
}));
vi.mock("react-native", () => ({ useWindowDimensions: () => viewport }));
vi.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => viewport,
}));

beforeEach(() =>
	Object.assign(viewport, { width: 951, fontScale: 1, left: 0, right: 0 }),
);
describe("responsive columns", () => {
	it("aligns the pane gutter with the crease despite right-side navigation", () => {
		viewport.right = 84;
		expect(usePaneWidth() + 12 + viewport.left).toBe(viewport.width / 2);
		expect(usePaneWidth(16) + 12 + 16 + viewport.left).toBe(viewport.width / 2);
	});
	it("also accounts for a left-side safe area", () => {
		viewport.left = 64;
		expect(usePaneWidth() + 12 + viewport.left).toBe(viewport.width / 2);
	});
	it("chooses grid columns from usable width and text size", () => {
		expect(useMediaCardColumns()).toBe(5);
		viewport.right = 84;
		expect(useMediaCardColumns()).toBe(4);
		viewport.width = 466;
		expect(useMediaCardColumns()).toBe(3);
		viewport.fontScale = 1.5;
		expect(useMediaCardColumns()).toBe(2);
	});
	it("uses two columns on the Duo inner display", () =>
		expect(useWideLayout()).toBe(true));
	it("keeps the outer display in one column", () => {
		viewport.width = 466;
		expect(useWideLayout()).toBe(false);
	});
	it("keeps large text readable in one column", () => {
		viewport.fontScale = 1.5;
		expect(useWideLayout()).toBe(false);
	});
	it("uses the safe content width rather than the full display", () => {
		viewport.width = 800;
		viewport.right = 80;
		expect(useWideLayout()).toBe(false);
	});
});
