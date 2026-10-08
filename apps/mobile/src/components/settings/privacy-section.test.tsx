import type { PrivacyStatusDto } from "@opnshelf/api";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacySection } from "./privacy-section";

const mocks = vi.hoisted(() => ({
	data: undefined as PrivacyStatusDto | undefined,
	mutate: vi.fn(),
	showDialog: vi.fn(),
	isError: false,
}));
vi.mock("@opnshelf/api", () => ({
	authControllerPermissions: vi.fn(),
	usePrivacy: () => ({
		query: { data: mocks.data, isError: mocks.isError },
		mutation: { mutate: mocks.mutate, isPending: false },
		pendingKey: null,
	}),
}));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ runAuthorizationUrl: vi.fn() }),
}));
vi.mock("@/lib/auth-handoff", () => ({ beginHandoff: vi.fn() }));
vi.mock("@/components/ui/dialog", () => ({
	useDialog: () => ({ showDialog: mocks.showDialog }),
}));
vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		Modal: (props: Record<string, unknown>) =>
			props.visible
				? createElement("dialog", props, props.children as never)
				: null,
		ScrollView: (props: Record<string, unknown>) =>
			createElement("scroll", props, props.children as never),
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
	};
});
vi.mock("react-native-safe-area-context", async () => {
	const { createElement } = await import("react");
	return {
		SafeAreaView: (props: Record<string, unknown>) =>
			createElement("safearea", props, props.children as never),
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
function render(onboarding = false, onContinue = vi.fn()) {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(
			<PrivacySection onboarding={onboarding} onContinue={onContinue} />,
		);
	});
	return renderer;
}
function button(renderer: ReactTestRenderer, label: string) {
	return renderer.root.find(
		(node) =>
			typeof node.type === "string" &&
			node.type === "button" &&
			node.props.label === label,
	);
}
beforeEach(() => {
	vi.clearAllMocks();
	mocks.isError = false;
	mocks.data = {
		availability: "available",
		authorized: true,
		listsDefaultVisibility: "public",
		alphaDetails: "Alpha",
		scopes: [
			{
				category: "watches",
				listRkey: null,
				label: "Watches",
				visibility: "public",
				migration: null,
			},
		],
	};
});
describe("Privacy Alpha mobile", () => {
	it("defaults onboarding to Public without writing", () => {
		const next = vi.fn();
		const renderer = render(true, next);
		expect(
			renderer.root.findAll(
				(node) => node.type === "button" && node.props.label === "Public",
			)[0].props.accessibilityState.selected,
		).toBe(true);
		act(() => button(renderer, "Continue").props.onPress());
		expect(next).toHaveBeenCalled();
		expect(mocks.mutate).not.toHaveBeenCalled();
	});
	it("shows category choices immediately in onboarding", () => {
		const renderer = render(true);
		const choices = renderer.root.findAll(
			(node) => node.type === "button" && node.props.label === "Private",
		);
		expect(choices.length).toBeGreaterThan(1);
		act(() => choices[0].props.onPress());
		expect(mocks.mutate).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "change",
				body: expect.objectContaining({
					category: "watches",
					visibility: "private",
				}),
			}),
		);
	});
	it("keeps onboarding usable when status fails", () => {
		mocks.data = undefined;
		mocks.isError = true;
		const next = vi.fn();
		const renderer = render(true, next);
		act(() =>
			button(renderer, "Continue without changing privacy").props.onPress(),
		);
		expect(next).toHaveBeenCalled();
		expect(mocks.mutate).not.toHaveBeenCalled();
	});
	it("asks how to apply a Lists choice before writing", () => {
		const renderer = render();
		const choice = renderer.root
			.findAll(
				(node) => node.type === "button" && node.props.label === "Private",
			)
			.at(-1);
		if (!choice) throw new Error("Lists choice missing");
		act(() => choice.props.onPress());
		expect(mocks.mutate).not.toHaveBeenCalled();
		const dialog = mocks.showDialog.mock.calls[0][0];
		act(() =>
			dialog.actions
				.find((action: { label: string }) => action.label === "New Lists only")
				.onPress(),
		);
		expect(mocks.mutate).toHaveBeenCalledWith({
			kind: "default",
			body: { category: "lists", visibility: "private" },
		});
	});
	it("confirms publication after choosing all Lists", () => {
		const renderer = render();
		const choice = renderer.root
			.findAll(
				(node) => node.type === "button" && node.props.label === "Public",
			)
			.at(-1);
		if (!choice) throw new Error("Lists choice missing");
		act(() => choice.props.onPress());
		act(() =>
			mocks.showDialog.mock.calls[0][0].actions
				.find((action: { label: string }) => action.label === "All Lists")
				.onPress(),
		);
		expect(mocks.mutate).not.toHaveBeenCalled();
		act(() =>
			mocks.showDialog.mock.calls[1][0].actions
				.find((action: { label: string }) => action.label === "Publish")
				.onPress(),
		);
		act(() =>
			mocks.showDialog.mock.calls[1][0].actions
				.find((action: { label: string }) => action.label === "Publish")
				.onDismiss(),
		);
		expect(renderer.root.findByType("dialog").props.visible).toBe(true);
		expect(mocks.mutate).toHaveBeenCalledWith({
			kind: "allLists",
			body: {
				category: "lists",
				visibility: "public",
				publicationConfirmed: true,
			},
		});
	});

	it("opens List progress once per migration and respects dismissal across polls", () => {
		if (!mocks.data) throw new Error("Missing status");
		const scope = {
			category: "lists" as const,
			label: "Favorites",
			listRkey: "favorites",
			visibility: "public" as const,
			migration: {
				id: "first",
				target: "private" as const,
				status: "queued" as const,
				copied: 0,
				total: 3,
				error: null,
			},
		};
		mocks.data.scopes.push(scope);
		const renderer = render();
		expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
		act(() => renderer.root.findByType("dialog").props.onRequestClose());
		mocks.data = { ...mocks.data, scopes: [...mocks.data.scopes] };
		act(() => renderer.update(<PrivacySection />));
		expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
		mocks.data = {
			...mocks.data,
			scopes: [{ ...scope, migration: { ...scope.migration, id: "second" } }],
		};
		act(() => renderer.update(<PrivacySection />));
		expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
	});

	it("opens Private All Lists progress only after the scope dialog dismisses", () => {
		const renderer = render();
		const choice = renderer.root
			.findAll(
				(node) => node.type === "button" && node.props.label === "Private",
			)
			.at(-1);
		if (!choice) throw new Error("Lists choice missing");
		act(() => choice.props.onPress());
		const actions = mocks.showDialog.mock.calls[0][0].actions;
		expect(
			actions.find(
				(action: { label: string }) => action.label === "New Lists only",
			).variant,
		).toBe("ghost");
		const allLists = actions.find(
			(action: { label: string }) => action.label === "All Lists",
		);
		act(() => allLists.onPress());
		expect(mocks.mutate).toHaveBeenCalledWith({
			kind: "allLists",
			body: { category: "lists", visibility: "private" },
		});
		expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
		act(() => allLists.onDismiss());
		expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
	});

	it("shows copy totals and finishing state", () => {
		if (!mocks.data) throw new Error("Missing status");
		mocks.data.scopes[0].migration = {
			id: "move",
			target: "private",
			status: "queued",
			copied: 3,
			total: 3,
			error: null,
		};
		const renderer = render();
		expect(JSON.stringify(renderer.toJSON())).toContain("3/3 records copied");
		expect(JSON.stringify(renderer.toJSON())).toContain("Finishing…");
	});

	it("requires a publication confirmation", () => {
		const renderer = render();
		// The category row is the first Public button; the new-List default is separate.
		const publicButton = renderer.root.findAll(
			(node) =>
				typeof node.type === "string" &&
				node.type === "button" &&
				node.props.label === "Public",
		)[0];
		act(() => publicButton.props.onPress());
		expect(mocks.mutate).not.toHaveBeenCalled();
		const dialog = mocks.showDialog.mock.calls[0][0];
		act(() =>
			dialog.actions
				.find((action: { label: string }) => action.label === "Publish")
				.onPress(),
		);
		expect(mocks.mutate).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ publicationConfirmed: true }),
			}),
		);
	});
});
