import type { PrivacyStatusDto } from "@opnshelf/api";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacySection } from "./privacy-section";

const mocks = vi.hoisted(() => ({
	data: undefined as PrivacyStatusDto | undefined,
	mutate: vi.fn(),
	showDialog: vi.fn(),
	runAuthorizationUrl: vi.fn(),
	authorize: undefined as (() => Promise<boolean>) | undefined,
	isError: false,
	mutationError: null as unknown,
}));
vi.mock("@opnshelf/api", async (importOriginal) => ({
	getErrorMessage: (await importOriginal<typeof import("@opnshelf/api")>())
		.getErrorMessage,
	authControllerPermissions: vi.fn(async () => ({
		data: { authorizationUrl: "https://pds.test/authorize" },
	})),
	usePrivacy: (authorize: () => Promise<boolean>) => {
		mocks.authorize = authorize;
		return {
			query: { data: mocks.data, isError: mocks.isError },
			mutation: {
				mutate: mocks.mutate,
				isPending: false,
				isError: mocks.mutationError !== null,
				error: mocks.mutationError,
			},
			pendingKey: null,
		};
	},
}));
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ runAuthorizationUrl: mocks.runAuthorizationUrl }),
}));
vi.mock("@/lib/auth-handoff", () => ({ beginHandoff: vi.fn() }));
vi.mock("@/components/ui/dialog", () => ({
	useDialog: () => ({ showDialog: mocks.showDialog }),
}));
vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		Platform: { OS: "ios" },
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
	mocks.mutationError = null;
	mocks.runAuthorizationUrl.mockResolvedValue(false);
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
				.onDismiss(),
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
				.onDismiss(),
		);
		expect(mocks.mutate).not.toHaveBeenCalled();
		act(() =>
			mocks.showDialog.mock.calls[1][0].actions
				.find((action: { label: string }) => action.label === "Publish")
				.onDismiss(),
		);
		expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
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

	it("waits for the scope dialog to dismiss before starting Private authorization", () => {
		const renderer = render();
		const choice = renderer.root
			.findAll(
				(node) => node.type === "button" && node.props.label === "Private",
			)
			.at(-1);
		if (!choice) throw new Error("Lists choice missing");
		act(() => choice.props.onPress());
		const actions = mocks.showDialog.mock.calls[0][0].actions;
		const allLists = actions.find(
			(action: { label: string }) => action.label === "All Lists",
		);
		act(() => allLists.onPress?.());
		expect(mocks.mutate).not.toHaveBeenCalled();
		act(() => allLists.onDismiss());
		expect(mocks.mutate).toHaveBeenCalledWith({
			kind: "allLists",
			body: { category: "lists", visibility: "private" },
		});
		// Bulk progress stays on this page, including after the server accepts migrations.
		expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
		if (!mocks.data) throw new Error("Missing status");
		mocks.data = {
			...mocks.data,
			scopes: [
				...mocks.data.scopes,
				{
					category: "lists",
					listRkey: "favorites",
					label: "Favorites",
					visibility: "public",
					migration: {
						id: "bulk",
						target: "private",
						status: "queued",
						copied: 0,
						total: 2,
						error: null,
					},
				},
			],
		};
		act(() => renderer.update(<PrivacySection />));
		expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
		act(() => button(renderer, "View List progress").props.onPress());
		expect(renderer.root.findAllByType("dialog")).toHaveLength(1);
	});

	it("shows a visible error dialog with the server reason rather than only inline text", () => {
		mocks.mutationError = {
			message: "Private access is unavailable on this PDS",
			statusCode: 400,
		};
		render();
		expect(mocks.showDialog).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Could not change privacy",
				description: "Private access is unavailable on this PDS",
			}),
		);
	});

	it("dismisses the List sheet before presenting authorization from an individual List", async () => {
		const renderer = render();
		act(() => button(renderer, "Manage individual Lists").props.onPress());
		const didDismiss = renderer.root.findByType("dialog").props.onDismiss;
		let authorization!: Promise<boolean>;
		await act(async () => {
			if (!mocks.authorize) throw new Error("Missing authorization callback");
			authorization = mocks.authorize();
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
		expect(mocks.runAuthorizationUrl).not.toHaveBeenCalled();
		await act(async () => {
			didDismiss();
			await authorization;
		});
		expect(mocks.runAuthorizationUrl).toHaveBeenCalledWith(
			"https://pds.test/authorize",
		);
	});

	it("dismisses the List sheet before showing a failed change and does not repeat it on polls", () => {
		const renderer = render();
		act(() => button(renderer, "Manage individual Lists").props.onPress());
		const didDismiss = renderer.root.findByType("dialog").props.onDismiss;
		mocks.mutationError = {
			statusCode: 409,
			message: "Another Watch operation is in progress. Try again.",
		};
		act(() => renderer.update(<PrivacySection />));
		expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
		expect(mocks.showDialog).not.toHaveBeenCalled();
		act(() => didDismiss());
		expect(mocks.showDialog).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Could not change privacy",
				description: "Another Watch operation is in progress. Try again.",
			}),
		);
		act(() => renderer.update(<PrivacySection />));
		expect(mocks.showDialog).toHaveBeenCalledOnce();
	});

	it("does not cover a bulk failure dialog with partially started migrations", () => {
		if (!mocks.data) throw new Error("Missing status");
		mocks.data.scopes.push({
			category: "lists",
			listRkey: "favorites",
			label: "Favorites",
			visibility: "public",
			migration: {
				id: "partial",
				target: "private",
				status: "queued",
				copied: 0,
				total: 3,
				error: null,
			},
		});
		mocks.mutationError = {
			statusCode: 409,
			message: "Another Watch operation is in progress. Try again.",
		};
		const renderer = render();
		expect(mocks.showDialog).toHaveBeenCalledOnce();
		expect(renderer.root.findAllByType("dialog")).toHaveLength(0);
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
				.onDismiss(),
		);
		expect(mocks.mutate).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ publicationConfirmed: true }),
			}),
		);
	});
});
