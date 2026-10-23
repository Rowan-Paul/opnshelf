import { createElement, type ReactNode, useState } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreenFrame } from "@/components/ui/screen-frame";
import { useDetailLayoutLock } from "@/lib/detail-layout-lock";
import { DetailColumns } from "./DetailColumns";

const layout = vi.hoisted(() => ({ wide: false }));
vi.mock("@/lib/use-wide-layout", () => ({
	useWideLayout: () => layout.wide,
	usePaneWidth: () => 463.5,
}));
vi.mock("react-native", () => {
	const host = (name: string) => (props: { children?: ReactNode }) =>
		createElement(name, props, props.children);
	return { View: host("view"), ScrollView: host("scroll-view") };
});
vi.mock("react-native-safe-area-context", () => ({
	SafeAreaView: (props: { children?: ReactNode }) =>
		createElement("safe-area", props, props.children),
}));
let renderer: ReactTestRenderer;
afterEach(() => {
	act(() => renderer.unmount());
	layout.wide = false;
});

function render(renderContent?: (header: ReactNode) => ReactNode) {
	act(() => {
		renderer = create(
			<ScreenFrame>
				<DetailColumns
					primary={createElement("view", { testID: "poster-and-actions" })}
					secondary={createElement("view", { testID: "all-content" })}
					renderContent={renderContent}
				/>
			</ScreenFrame>,
		);
	});
}

describe("detail panes", () => {
	it("keeps compact content and actions in one scroll view with horizontal clearance", () => {
		render();
		expect(renderer.root.findAllByType(ScrollView)).toHaveLength(1);
		expect(renderer.root.findByType(SafeAreaView).props.edges).toEqual([
			"left",
			"right",
		]);
		const page = renderer.root.findByType(ScrollView);
		expect(page.findByProps({ testID: "poster-and-actions" })).toBeDefined();
		expect(page.findByProps({ testID: "all-content" })).toBeDefined();
	});

	it("does not apply clearance twice when nested inside a navigator frame", () => {
		act(() => {
			renderer = create(
				<ScreenFrame>
					<ScreenFrame>
						<DetailColumns primary={null} secondary={null} />
					</ScreenFrame>
				</ScreenFrame>,
			);
		});
		expect(renderer.root.findAllByType(SafeAreaView)).toHaveLength(1);
	});

	it("lets wide supporting content scroll without moving the poster and actions", () => {
		layout.wide = true;
		render();
		const [poster, content] = renderer.root.findAllByType(ScrollView);
		expect(renderer.root.findAllByType(ScrollView)).toHaveLength(2);
		expect(poster.findByProps({ testID: "poster-and-actions" })).toBeDefined();
		expect(poster.findAllByProps({ testID: "all-content" })).toHaveLength(0);
		expect(content.findByProps({ testID: "all-content" })).toBeDefined();
		expect(
			content.findAllByProps({ testID: "poster-and-actions" }),
		).toHaveLength(0);
	});

	it.each([
		false,
		true,
	])("keeps a season's virtualized list separate in wide=%s", (wide) => {
		layout.wide = wide;
		render((header) =>
			createElement("view", { testID: "episode-list" }, header),
		);
		const list = renderer.root.findByProps({ testID: "episode-list" });
		expect(list.findByProps({ testID: "all-content" })).toBeDefined();
		expect(list.findAllByProps({ testID: "poster-and-actions" })).toHaveLength(
			wide ? 0 : 1,
		);
	});
});

function DraftEditor() {
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState("");
	useDetailLayoutLock(open);
	return createElement("draft-editor", {
		testID: "draft-editor",
		open,
		draft,
		onOpen: () => setOpen(true),
		onChange: setDraft,
		onClose: () => setOpen(false),
	});
}

it.each([
	false,
	true,
])("preserves an edited open sheet across a fold from wide=%s", (wide) => {
	layout.wide = wide;
	const page = () => (
		<DetailColumns primary={<DraftEditor />} secondary={null} />
	);
	act(() => {
		renderer = create(page());
	});
	const editor = () => renderer.root.findByProps({ testID: "draft-editor" });
	act(() => {
		editor().props.onOpen();
		editor().props.onChange("Unsaved review draft");
	});
	layout.wide = !wide;
	act(() => renderer.update(page()));
	expect(editor().props.open).toBe(true);
	expect(editor().props.draft).toBe("Unsaved review draft");
	expect(renderer.root.findAllByType(ScrollView)).toHaveLength(wide ? 2 : 1);
	act(() => editor().props.onClose());
	expect(renderer.root.findAllByType(ScrollView)).toHaveLength(wide ? 1 : 2);
});
