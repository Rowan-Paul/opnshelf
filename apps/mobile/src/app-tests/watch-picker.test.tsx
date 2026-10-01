import {
	createElement,
	forwardRef,
	type PropsWithChildren,
	useImperativeHandle,
} from "react";
import { ScrollView, TextInput } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { UpNextServiceFilter } from "@/components/up-next/UpNextServiceFilter";
import PickerScreen from "../app/pick-for-me";

const mocks = vi.hoisted(() => ({
	save: vi.fn(),
	scrollTo: vi.fn(),
	dismissKeyboard: vi.fn(),
	user: { did: "did:plc:picker-test", handle: "picker.test" },
}));
function host(name: string) {
	return ({ children, ...props }: PropsWithChildren) =>
		createElement(name, props, children);
}
vi.mock("react-native", () => ({
	View: host("View"),
	ScrollView: forwardRef(({ children, ...props }: PropsWithChildren, ref) => {
		useImperativeHandle(ref, () => ({ scrollTo: mocks.scrollTo }));
		return createElement("ScrollView", props, children);
	}),
	Keyboard: { dismiss: mocks.dismissKeyboard },
	Pressable: host("Pressable"),
	TextInput: host("TextInput"),
	Image: host("Image"),
	Modal: ({
		visible,
		children,
	}: {
		visible: boolean;
		children: React.ReactNode;
	}) => (visible ? children : null),
	Linking: { openURL: vi.fn() },
}));
vi.mock("expo-router", () => ({
	Link: host("Link"),
	Stack: { Screen: host("StackScreen") },
}));
vi.mock("expo-secure-store", () => ({
	getItemAsync: () => Promise.resolve(null),
	setItemAsync: mocks.save,
}));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ user: mocks.user, isLoading: false }),
}));
vi.mock("@/components/ui/button", () => ({ Button: host("Button") }));
vi.mock("@/components/ui/text", () => ({ Text: host("Text") }));
vi.mock("@/components/ui/screen", () => ({ Screen: host("Screen") }));
vi.mock("@/components/up-next/UpNextServiceFilter", () => ({
	UpNextServiceFilter: host("ServiceFilter"),
}));
vi.mock("@tanstack/react-query", () => {
	const settings = { watchCountry: "NL", streamingServiceIds: [8] };
	const services = { services: [{ id: 8, name: "Netflix" }] };
	const results = {
		genres: ["Drama"],
		items: [
			{
				id: "movie:1",
				mediaType: "movie",
				mediaId: "1",
				title: "Tonight’s movie",
				minutes: 120,
				estimated: false,
				episodes: [],
				services: [],
			},
		],
	};
	return {
		queryOptions: (options: unknown) => options,
		useQuery: (options: { queryKey: { _id: string }[]; enabled: boolean }) => ({
			data:
				options.queryKey[0]._id === "usersControllerGetMySettings"
					? settings
					: options.queryKey[0]._id === "streamingServicesControllerList"
						? services
						: options.enabled
							? results
							: undefined,
			isFetching: false,
			isError: false,
			isLoading: false,
		}),
	};
});
async function renderPicker() {
	let view: ReactTestRenderer | undefined;
	await act(async () => {
		view = create(<PickerScreen />);
	});
	if (!view) throw new Error("Picker did not render");
	return view;
}
function button(view: ReactTestRenderer, label: string) {
	return view.root.findAll(
		(node) => node.type === Button && node.props.label === label,
	)[0];
}
beforeEach(() => {
	mocks.scrollTo.mockClear();
	mocks.dismissKeyboard.mockClear();
	mocks.save.mockReset();
	mocks.save.mockResolvedValue(undefined);
});
describe("Mobile picker session", () => {
	it("defaults to 180 minutes, exhausts without repeats, and explicitly resets skips", async () => {
		const view = await renderPicker();
		expect(view.root.findByType(TextInput).props.value).toBe("180");
		expect(button(view, "Pick for me").props.disabled).toBe(false);
		act(() => {
			view.root
				.find((node) => typeof node.props.onLayout === "function")
				.props.onLayout({ nativeEvent: { layout: { y: 600 } } });
		});
		await act(async () => button(view, "Pick for me").props.onPress());
		act(() => view.root.findByType(ScrollView).props.onContentSizeChange());
		expect(mocks.dismissKeyboard).toHaveBeenCalledOnce();
		expect(mocks.scrollTo).toHaveBeenLastCalledWith({ y: 584, animated: true });
		expect(JSON.stringify(view.toJSON())).toContain("Tonight’s movie");
		await act(async () => button(view, "Pick again").props.onPress());
		expect(JSON.stringify(view.toJSON())).toContain("You’ve tried every match");
		expect(button(view, "Pick again")).toBeUndefined();
		await act(async () => button(view, "Reset skips").props.onPress());
		expect(JSON.stringify(view.toJSON())).toContain("Tonight’s movie");
		await act(async () => view.unmount());
	});
	it("explains empty and invalid time and clears the error after correction", async () => {
		const view = await renderPicker();
		for (const value of ["", "0", "1441", "1.5"]) {
			await act(async () =>
				view.root.findByType(TextInput).props.onChangeText(value),
			);
			expect(button(view, "Pick for me").props.disabled).toBe(true);
			expect(JSON.stringify(view.toJSON())).toContain(
				value ? "Enter a whole number" : "Enter how many minutes",
			);
		}
		await act(async () =>
			view.root.findByType(TextInput).props.onChangeText("120"),
		);
		expect(button(view, "Pick for me").props.disabled).toBe(false);
		expect(JSON.stringify(view.toJSON())).not.toContain("Enter a whole number");
		await act(async () => view.unmount());
	});
	it("clears all filters without clearing time and persists the unrestricted choice", async () => {
		const view = await renderPicker();
		await act(async () =>
			view.root.findByType(TextInput).props.onChangeText("180"),
		);
		await act(async () => button(view, "Clear all filters").props.onPress());
		expect(view.root.findByType(TextInput).props.value).toBe("180");
		expect(
			view.root.findByType(UpNextServiceFilter).props.value,
		).toBeUndefined();
		expect(JSON.parse(mocks.save.mock.calls.at(-1)?.[1])).toEqual({
			type: "both",
			progress: "both",
			genre: "",
		});
		await act(async () => view.unmount());
	});
});
