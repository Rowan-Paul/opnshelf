import { createElement, type PropsWithChildren } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, expect, it, vi } from "vitest";
import AtStoreReviewScreen from "@/app/atstore-review";

const mocks = vi.hoisted(() => ({
	back: vi.fn(),
	showDialog: vi.fn(),
	setQueryData: vi.fn(),
	disablePrevention: vi.fn(),
	blocked: false,
	onPrevent: (_event: { repeat: () => void }) => {},
	onSuccess: () => {},
}));
function host(name: string) {
	return ({ children, ...props }: PropsWithChildren) =>
		createElement(name, props, children);
}
vi.mock("expo-router", () => ({
	router: { back: mocks.back },
	usePreventRemove: (blocked: boolean, callback: typeof mocks.onPrevent) => {
		mocks.blocked = blocked;
		mocks.onPrevent = callback;
		return mocks.disablePrevention;
	},
}));
vi.mock("react-native", () => ({
	ScrollView: host("scroll"),
	Pressable: host("pressable"),
	View: host("view"),
}));
vi.mock("@opnshelf/api", () => ({
	atStoreReviewsControllerPublishMutation: () => ({}),
	atStoreReviewsControllerGetPromptOptions: () => ({ queryKey: ["prompt"] }),
}));
vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ setQueryData: mocks.setQueryData }),
	useMutation: ({ onSuccess }: { onSuccess: () => void }) => {
		mocks.onSuccess = onSuccess;
		return { isPending: false, mutate: vi.fn() };
	},
}));
vi.mock("expo-haptics", () => ({}));
vi.mock("lucide-react-native", () => ({ Star: host("star") }));
vi.mock("@/lib/posthog", () => ({ posthog: null }));
vi.mock("@/components/ui/button", () => ({ Button: host("button") }));
vi.mock("@/components/ui/text", () => ({ Text: host("text") }));
vi.mock("@/components/ui/text-field", () => ({ TextField: host("field") }));
vi.mock("@/components/ui/toast", () => ({
	useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/components/ui/dialog", () => ({
	useDialog: () => ({ showDialog: mocks.showDialog }),
}));

let rendered: ReactTestRenderer;
function render() {
	act(() => {
		rendered = create(<AtStoreReviewScreen />);
	});
	return rendered.root;
}
function enterDraft() {
	const root = render();
	act(() => {
		root
			.find((node) => node.props.label === "Review (optional)")
			.props.onChangeText("Draft review");
	});
	return root;
}
beforeEach(() => {
	mocks.back.mockReset();
	mocks.showDialog.mockReset();
	mocks.setQueryData.mockReset();
	mocks.disablePrevention.mockReset();
	mocks.disablePrevention.mockImplementation(() => {
		mocks.blocked = false;
	});
	mocks.back.mockImplementation(() => {
		if (mocks.blocked) mocks.onPrevent({ repeat: vi.fn() });
	});
	mocks.blocked = false;
});

it("permits closing a clean composer", () => {
	const root = render();
	expect(mocks.blocked).toBe(false);
	act(() => {
		root.find((node) => node.props.label === "Cancel").props.onPress();
	});
	expect(mocks.back).toHaveBeenCalledOnce();
});

it("keeps the draft when the user declines to discard", () => {
	enterDraft();
	expect(mocks.blocked).toBe(true);
	const repeat = vi.fn();
	act(() => mocks.onPrevent({ repeat }));
	const dialog = mocks.showDialog.mock.calls[0][0];
	expect(dialog.title).toBe("Discard this review?");
	expect(dialog.actions[0]).toEqual({ label: "Keep editing" });
	expect(repeat).not.toHaveBeenCalled();
	expect(mocks.blocked).toBe(true);
});

it("unblocks navigation and repeats the exact action after confirmed discard", () => {
	enterDraft();
	const repeat = vi.fn();
	act(() => mocks.onPrevent({ repeat }));
	act(() => mocks.showDialog.mock.calls[0][0].actions[1].onPress());
	expect(mocks.blocked).toBe(false);
	expect(repeat).toHaveBeenCalledOnce();
});

it("does not prompt again after successful publication", () => {
	enterDraft();
	act(() => mocks.onSuccess());
	expect(mocks.blocked).toBe(false);
	expect(mocks.back).toHaveBeenCalledOnce();
	expect(mocks.disablePrevention).toHaveBeenCalledOnce();
	expect(mocks.disablePrevention.mock.invocationCallOrder[0]).toBeLessThan(
		mocks.back.mock.invocationCallOrder[0],
	);
	expect(mocks.showDialog).not.toHaveBeenCalled();
	expect(mocks.setQueryData).toHaveBeenCalledWith(["prompt"], {
		eligible: false,
		permissionGranted: true,
	});
});
