import {
	act,
	create,
	type ReactTestInstance,
	type ReactTestRenderer,
} from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { WatchDatePickerModal } from "./WatchDatePickerModal";

vi.mock("@/lib/use-tw-style", () => ({ useTwStyle: () => ({}) }));

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	const component = (name: string) => (props: Record<string, unknown>) =>
		createElement(name, props, props.children as never);
	return {
		Modal: component("modal"),
		Platform: { OS: "ios" },
		Pressable: component("pressable"),
		Text: component("text"),
		View: component("view"),
		useColorScheme: () => "dark",
	};
});

vi.mock("@react-native-community/datetimepicker", async () => {
	const { createElement } = await import("react");
	return {
		default: (props: Record<string, unknown>) =>
			createElement("datetimepicker", props),
	};
});

vi.mock("lucide-react-native", async () => {
	const { createElement } = await import("react");
	return {
		Calendar: () => createElement("calendar"),
		Clock: () => createElement("clock"),
		X: () => createElement("close"),
	};
});

/** The "No date" affordance, found by the copy the glossary makes canonical. */
function findNoDatePressable(
	renderer: ReactTestRenderer,
): ReactTestInstance | undefined {
	const label = renderer.root
		.findAllByType("text" as never)
		.find((node) => node.props.children === "No date");

	let node: ReactTestInstance | null = label?.parent ?? null;
	while (node && (node.type as string) !== "pressable") node = node.parent;
	return node ?? undefined;
}

function renderModal(onConfirm: (iso: string | null) => void) {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(
			<WatchDatePickerModal
				visible
				onDismiss={vi.fn()}
				onConfirm={onConfirm}
			/>,
		);
	});
	return renderer;
}

describe("WatchDatePickerModal", () => {
	it("creates an undated Watch when the user picks No date", () => {
		const onConfirm = vi.fn();
		const renderer = renderModal(onConfirm);

		const noDate = findNoDatePressable(renderer);
		expect(noDate).toBeDefined();

		act(() => {
			noDate?.props.onPress();
		});

		// null, not undefined: undefined would let the server stamp "now",
		// which is the thing an undated Watch exists to avoid.
		expect(onConfirm).toHaveBeenCalledWith(null);
	});

	it("submits No date on a single tap, without a second confirm", () => {
		const onConfirm = vi.fn();
		const renderer = renderModal(onConfirm);

		act(() => {
			findNoDatePressable(renderer)?.props.onPress();
		});

		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("does not offer a future watch date", () => {
		const renderer = renderModal(vi.fn());

		const picker = renderer.root.findByType("datetimepicker" as never);
		expect(picker.props.maximumDate).toBeInstanceOf(Date);
		expect(picker.props.maximumDate.getTime()).toBeLessThanOrEqual(Date.now());
	});

	it("re-seeds the date on every open instead of keeping the last pick", () => {
		const onConfirm = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<WatchDatePickerModal
					visible
					onDismiss={vi.fn()}
					onConfirm={onConfirm}
				/>,
			);
		});

		// Pick a date in the past, then close and reopen the still-mounted modal.
		const picked = new Date("2020-01-02T03:04:05.000Z");
		act(() => {
			renderer.root
				.findByType("datetimepicker" as never)
				.props.onChange({ type: "set" }, picked);
		});
		act(() => {
			renderer.update(
				<WatchDatePickerModal
					visible={false}
					onDismiss={vi.fn()}
					onConfirm={onConfirm}
				/>,
			);
		});
		act(() => {
			renderer.update(
				<WatchDatePickerModal
					visible
					onDismiss={vi.fn()}
					onConfirm={onConfirm}
				/>,
			);
		});

		const picker = renderer.root.findByType("datetimepicker" as never);
		expect(picker.props.value.getTime()).toBeGreaterThan(picked.getTime());
	});
});

describe("editing a Watch", () => {
	function edit(initialWatchedAt: string | null) {
		const onConfirm = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<WatchDatePickerModal
					visible
					initialWatchedAt={initialWatchedAt}
					timeZone="Europe/Amsterdam"
					onDismiss={vi.fn()}
					onConfirm={onConfirm}
				/>,
			);
		});
		return { renderer, onConfirm };
	}
	function save(renderer: ReactTestRenderer) {
		const button = renderer.root.findAll(
			(node) =>
				node.props.label === "Save" && typeof node.props.onPress === "function",
		)[0];
		act(() => button.props.onPress());
	}
	it("preserves an unchanged timestamp and uses the saved timezone", () => {
		const { renderer, onConfirm } = edit("2020-07-04T18:15:42.123Z");
		expect(
			renderer.root.findByType("datetimepicker" as never).props.timeZoneName,
		).toBe("Europe/Amsterdam");
		save(renderer);
		expect(onConfirm).toHaveBeenCalledWith("2020-07-04T18:15:42.123Z");
	});
	it("only clears the date after Save", () => {
		const { renderer, onConfirm } = edit("2020-07-04T18:15:42.123Z");
		act(() => findNoDatePressable(renderer)?.props.onPress());
		expect(onConfirm).not.toHaveBeenCalled();
		save(renderer);
		expect(onConfirm).toHaveBeenCalledWith(null);
	});
	it("opens an undated Watch with No date selected", () => {
		const { renderer, onConfirm } = edit(null);
		expect(renderer.root.findAllByType("datetimepicker" as never)).toHaveLength(
			0,
		);
		save(renderer);
		expect(onConfirm).toHaveBeenCalledWith(null);
	});
});
