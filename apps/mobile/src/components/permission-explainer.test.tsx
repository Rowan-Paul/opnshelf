import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { usePermissionExplainer } from "./permission-explainer";

const AUTHORIZATION_URL = "https://bsky.social/oauth/authorize?request_uri=x";

const mocks = vi.hoisted(() => ({
	closeSheet: undefined as (() => void) | undefined,
}));

vi.mock("lucide-react-native", () => ({
	Check: () => null,
	Smartphone: () => null,
	X: () => null,
}));
vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		Pressable: (props: Record<string, unknown>) =>
			createElement("pressable", props, props.children as never),
		ScrollView: (props: Record<string, unknown>) =>
			createElement("scroll", props, props.children as never),
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
	};
});
vi.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
// The test finishes the close animation itself through `mocks.closeSheet`.
vi.mock("@/components/ui/bottom-sheet-modal", async () => {
	const { createElement } = await import("react");
	return {
		BottomSheetModal: (props: {
			visible: boolean;
			onClosed?: () => void;
			children: never;
		}) => {
			mocks.closeSheet = props.visible ? undefined : props.onClosed;
			return props.visible
				? createElement("sheet", null, props.children)
				: null;
		},
	};
});
vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});
vi.mock("@/components/ui/button", async () => {
	const { createElement } = await import("react");
	return {
		Button: (props: Record<string, unknown>) => createElement("button", props),
	};
});
vi.mock("@/theme/colors", () => ({
	useThemeColors: () => ({ mutedForeground: "#999", success: "#0a0" }),
}));

type Explainer = ReturnType<typeof usePermissionExplainer>;

function render() {
	const explainer: { current?: Explainer } = {};
	function Harness() {
		explainer.current = usePermissionExplainer();
		return explainer.current.sheet;
	}
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(<Harness />);
	});
	return { renderer, explainer: explainer as { current: Explainer } };
}

function text(renderer: ReactTestRenderer) {
	return renderer.root
		.findAll((node) => node.type === "text")
		.flatMap((node) => [node.props.children].flat())
		.join("");
}

function button(renderer: ReactTestRenderer, label: string) {
	return renderer.root.find(
		(node) => node.type === "button" && node.props.label === label,
	);
}

describe("usePermissionExplainer", () => {
	it("names the Account Host and settles only after the sheet has closed", async () => {
		const { renderer, explainer } = render();
		let finish!: (url: string) => void;
		const onResult = vi.fn();
		act(() => {
			void explainer.current
				.request({
					integration: "bluesky",
					action: "connect",
					start: () =>
						new Promise((resolve) => {
							finish = resolve;
						}),
				})
				.then(onResult);
		});

		// Nothing opens until the authorization request exists.
		expect(
			renderer.root.findAll((node) => String(node.type) === "sheet"),
		).toHaveLength(0);

		await act(async () => finish(AUTHORIZATION_URL));
		expect(text(renderer)).toContain("Let Opnshelf post to Bluesky");
		expect(text(renderer)).toContain("bsky.social");
		expect(text(renderer)).toContain(
			"Your other Devices will need to sign in again",
		);

		act(() => button(renderer, "Continue to bsky.social").props.onPress());
		await act(async () => {});
		// Still animating out: the auth session must not open yet.
		expect(onResult).not.toHaveBeenCalled();

		await act(async () => mocks.closeSheet?.());
		expect(onResult).toHaveBeenCalledWith(AUTHORIZATION_URL);
	});

	it("resolves with nothing to open when the User backs out", async () => {
		const { renderer, explainer } = render();
		const onResult = vi.fn();
		act(() => {
			void explainer.current
				.request({
					integration: "atstore",
					action: "connect",
					start: () => Promise.resolve(AUTHORIZATION_URL),
				})
				.then(onResult);
		});
		await act(async () => {});

		act(() => button(renderer, "Not now").props.onPress());
		await act(async () => mocks.closeSheet?.());

		expect(onResult).toHaveBeenCalledWith(null);
	});

	it("opens nothing and rejects when the request can't be made", async () => {
		const { renderer, explainer } = render();
		const failure = new Error("A public Bluesky profile is required");
		const onError = vi.fn();
		act(() => {
			void explainer.current
				.request({
					integration: "bluesky",
					action: "connect",
					start: () => Promise.reject(failure),
				})
				.catch(onError);
		});
		await act(async () => {});

		expect(onError).toHaveBeenCalledWith(failure);
		expect(
			renderer.root.findAll((node) => String(node.type) === "sheet"),
		).toHaveLength(0);
	});
});
