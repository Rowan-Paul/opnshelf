import { Redirect } from "expo-router";
import { createElement, type PropsWithChildren } from "react";
import { TextInput } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { UpNextServiceFilter } from "@/components/up-next/UpNextServiceFilter";
import PickerScreen from "@/components/watch-picker/PickerScreen";

const mocks = vi.hoisted(() => ({
	params: {} as { minutes?: string; filters?: string },
	push: vi.fn(),
	dismissTo: vi.fn(),
	back: vi.fn(),
	canGoBack: vi.fn(() => true),
	replace: vi.fn(),
	save: vi.fn(),
	loading: false,
	error: false,
	refetch: vi.fn(),
	request: undefined as unknown,
	dismissKeyboard: vi.fn(),
	user: { did: "did:plc:picker-test", handle: "picker.test" } as {
		did: string;
		handle: string;
		needsEmailVerification?: boolean;
		needsOnboarding?: boolean;
	} | null,
	authLoading: false,
	queryEnabled: [] as boolean[],
}));
function host(name: string) {
	return ({ children, ...props }: PropsWithChildren) =>
		createElement(name, props, children);
}
vi.mock("react-native", () => ({
	View: host("View"),
	ScrollView: host("ScrollView"),
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
	useLocalSearchParams: () => mocks.params,
	useRouter: () => ({
		push: mocks.push,
		dismissTo: mocks.dismissTo,
		back: mocks.back,
		canGoBack: mocks.canGoBack,
		replace: mocks.replace,
	}),
	Redirect: host("Redirect"),
	Link: host("Link"),
	Stack: { Screen: host("StackScreen") },
}));
vi.mock("expo-secure-store", () => ({
	getItemAsync: () => Promise.resolve(null),
	setItemAsync: mocks.save,
}));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ user: mocks.user, isLoading: mocks.authLoading }),
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
		useQuery: (options: { queryKey: { _id: string }[]; enabled: boolean }) => {
			mocks.queryEnabled.push(options.enabled);
			const picker = options.queryKey[0]._id === "watchPickerControllerGet";
			if (picker) mocks.request = options.queryKey;
			return {
				data:
					options.queryKey[0]._id === "usersControllerGetMySettings"
						? settings
						: options.queryKey[0]._id === "streamingServicesControllerList"
							? services
							: options.enabled
								? results
								: undefined,
				isFetching: picker && mocks.loading,
				isError: picker && mocks.error,
				refetch: mocks.refetch,
				isLoading: false,
			};
		},
	};
});
async function renderPicker(result = false) {
	let view: ReactTestRenderer | undefined;
	await act(async () => {
		view = create(<PickerScreen result={result} />);
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
	mocks.user = { did: "did:plc:picker-test", handle: "picker.test" };
	mocks.authLoading = false;
	mocks.queryEnabled = [];
	mocks.params = {};
	mocks.canGoBack.mockReturnValue(true);
	mocks.push.mockClear();
	mocks.dismissTo.mockClear();
	mocks.back.mockClear();
	mocks.replace.mockClear();
	mocks.loading = false;
	mocks.error = false;
	mocks.refetch.mockClear();
	mocks.dismissKeyboard.mockClear();
	mocks.save.mockReset();
	mocks.save.mockResolvedValue(undefined);
});
describe("Mobile picker session", () => {
	it.each([
		[null, "/login"],
		[{ needsEmailVerification: true, needsOnboarding: true }, "/verify-email"],
		[{ needsOnboarding: true }, "/onboarding"],
	] as const)("gates direct picker and result links for %j", async (flags, href) => {
		mocks.user = flags
			? { did: "did:plc:picker-test", handle: "picker.test", ...flags }
			: null;
		for (const result of [false, true]) {
			const view = await renderPicker(result);
			expect(view.root.findByType(Redirect).props.href).toBe(href);
			expect(mocks.queryEnabled.every((enabled) => !enabled)).toBe(true);
			await act(async () => view.unmount());
		}
	});
	it("waits for session restoration before redirecting or fetching", async () => {
		mocks.user = null;
		mocks.authLoading = true;
		const view = await renderPicker();
		expect(view.root.findAllByType(Redirect)).toHaveLength(0);
		expect(mocks.queryEnabled.every((enabled) => !enabled)).toBe(true);
		await act(async () => view.unmount());
	});
	it("opens a separate result screen with the submitted time and filters", async () => {
		const view = await renderPicker();
		expect(view.root.findByType(TextInput).props.value).toBe("180");
		await act(async () => button(view, "Pick for me").props.onPress());
		expect(mocks.dismissKeyboard).toHaveBeenCalledOnce();
		expect(mocks.push).toHaveBeenCalledWith({
			pathname: "/pick-for-me/result",
			params: {
				minutes: "180",
				filters: JSON.stringify({
					type: "both",
					progress: "both",
					genre: "",
					services: "8",
				}),
			},
		});
		expect(JSON.stringify(view.toJSON())).not.toContain("Tonight’s movie");
		await act(async () => view.unmount());
	});
	it("shows results without filters, exhausts without repeats, resets skips, and returns to filters", async () => {
		mocks.params = {
			minutes: "180",
			filters: JSON.stringify({
				type: "movie",
				progress: "both",
				genre: "Drama",
			}),
		};
		const view = await renderPicker(true);
		expect(view.root.findAllByType(TextInput)).toHaveLength(0);
		expect(JSON.stringify(mocks.request)).toContain('"genre":"Drama"');
		expect(button(view, "Pick for me")).toBeUndefined();
		expect(JSON.stringify(view.toJSON())).toContain("Tonight’s movie");
		await act(async () => button(view, "Pick again").props.onPress());
		expect(JSON.stringify(view.toJSON())).toContain("You’ve tried every match");
		expect(button(view, "Pick again")).toBeUndefined();
		await act(async () => button(view, "Reset skips").props.onPress());
		expect(JSON.stringify(view.toJSON())).toContain("Tonight’s movie");
		await act(async () => button(view, "Change filters").props.onPress());
		expect(mocks.dismissTo).toHaveBeenCalledWith({
			pathname: "/pick-for-me",
			params: mocks.params,
		});
		expect(mocks.back).not.toHaveBeenCalled();
		await act(async () => view.unmount());
	});
	it.each([
		true,
		false,
	])("returns a direct result to its configured filters even with unrelated back history (%s)", async (canGoBack) => {
		const filters = JSON.stringify({
			type: "movie",
			progress: "both",
			genre: "Drama",
		});
		mocks.params = { minutes: "150", filters };
		mocks.canGoBack.mockReturnValue(canGoBack);
		const view = await renderPicker(true);
		await act(async () => button(view, "Change filters").props.onPress());
		expect(mocks.dismissTo).toHaveBeenCalledWith({
			pathname: "/pick-for-me",
			params: { minutes: "150", filters },
		});
		expect(mocks.back).not.toHaveBeenCalled();
		expect(mocks.replace).not.toHaveBeenCalled();
		await act(async () => view.unmount());
	});
	it("keeps loading and retry states on the result screen", async () => {
		mocks.params = { minutes: "180" };
		mocks.loading = true;
		const view = await renderPicker(true);
		expect(JSON.stringify(view.toJSON())).toContain(
			"Finding something to watch",
		);
		expect(view.root.findAllByType(TextInput)).toHaveLength(0);
		mocks.loading = false;
		mocks.error = true;
		await act(async () => view.update(<PickerScreen result />));
		expect(JSON.stringify(view.toJSON())).toContain(
			"Couldn't find suggestions",
		);
		await act(async () => button(view, "Try again").props.onPress());
		expect(mocks.refetch).toHaveBeenCalledOnce();
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
