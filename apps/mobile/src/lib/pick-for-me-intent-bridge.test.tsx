import type { AppIntentInvocation, AppIntentsHandler } from "expo-app-intents";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PickForMeIntentBridge } from "./pick-for-me-intent-bridge";

const mocks = vi.hoisted(() => ({
	loading: true,
	key: undefined as string | undefined,
	pathname: "/",
	platform: "ios",
	navigate: vi.fn(),
	remove: vi.fn(),
	handler: undefined as AppIntentsHandler | undefined,
}));
vi.mock("expo-app-intents", () => ({
	useAppIntents: (handler: AppIntentsHandler) => {
		mocks.handler = handler;
	},
	removePendingInvocationAsync: mocks.remove,
}));
vi.mock("expo-router", () => ({
	useRootNavigationState: () => ({ key: mocks.key }),
	useRouter: () => ({ navigate: mocks.navigate }),
	usePathname: () => mocks.pathname,
}));
vi.mock("react-native", () => ({
	Platform: {
		get OS() {
			return mocks.platform;
		},
	},
}));
vi.mock("./auth-context", () => ({
	useAuth: () => ({
		isLoading: mocks.loading,
		user: { handle: "synthetic.test" },
	}),
}));

function invocation(id: string, name = "openPickForMe"): AppIntentInvocation {
	return { id, name, params: {}, createdAt: 1 };
}
async function deliver(pending: AppIntentInvocation[]) {
	if (!mocks.handler) throw new Error("Consumer is not ready");
	await act(async () => {
		await mocks.handler?.(pending, null);
	});
}
let view: ReactTestRenderer;
beforeEach(() => {
	mocks.loading = true;
	mocks.key = undefined;
	mocks.pathname = "/";
	mocks.platform = "ios";
	mocks.handler = undefined;
	mocks.navigate.mockReset();
	mocks.remove.mockReset().mockResolvedValue(undefined);
});
async function renderReady() {
	mocks.loading = false;
	mocks.key = "ready";
	await act(async () => {
		view = create(<PickForMeIntentBridge />);
	});
}
describe("Pick for me App Intent delivery", () => {
	it("waits for auth and navigation, then consumes the initial cold-start batch", async () => {
		await act(async () => {
			view = create(<PickForMeIntentBridge />);
		});
		expect(mocks.handler).toBeUndefined();
		mocks.loading = false;
		await act(async () => view.update(<PickForMeIntentBridge />));
		expect(mocks.handler).toBeUndefined();
		mocks.key = "ready";
		await act(async () => view.update(<PickForMeIntentBridge />));
		await deliver([invocation("cold")]);
		expect(mocks.navigate).toHaveBeenCalledWith("/pick-for-me");
		expect(mocks.remove).toHaveBeenCalledWith("cold");
	});
	it("coalesces duplicate batches and does not consume unrelated actions", async () => {
		await renderReady();
		const pending = [
			invocation("a"),
			invocation("b"),
			invocation("other", "other"),
		];
		await deliver(pending);
		await deliver(pending);
		expect(mocks.navigate).toHaveBeenCalledOnce();
		expect(mocks.remove.mock.calls.map(([id]) => id)).toEqual([
			"a",
			"b",
			"a",
			"b",
		]);
	});
	it("reuses the visible chooser but navigates away from a result", async () => {
		mocks.pathname = "/pick-for-me";
		await renderReady();
		await deliver([invocation("a")]);
		expect(mocks.navigate).not.toHaveBeenCalled();
		mocks.pathname = "/pick-for-me/result";
		await act(async () => view.update(<PickForMeIntentBridge />));
		await deliver([invocation("b")]);
		expect(mocks.navigate).toHaveBeenCalledWith("/pick-for-me");
	});
	it("retains the queue when navigation fails", async () => {
		await renderReady();
		mocks.navigate.mockImplementationOnce(() => {
			throw new Error("not ready");
		});
		await expect(deliver([invocation("a")])).rejects.toThrow("not ready");
		expect(mocks.remove).not.toHaveBeenCalled();
		await deliver([invocation("a")]);
		expect(mocks.remove).toHaveBeenCalledWith("a");
	});
	it("retries failed acknowledgements without repeating navigation", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		await renderReady();
		mocks.remove.mockRejectedValueOnce(new Error("storage unavailable"));
		await deliver([invocation("a"), invocation("b")]);
		await deliver([invocation("a")]);
		expect(mocks.navigate).toHaveBeenCalledOnce();
		expect(mocks.remove.mock.calls.map(([id]) => id)).toEqual(["a", "b", "a"]);
	});
	it("uses the latest valid action in a mixed cold batch", async () => {
		await renderReady();
		await deliver([
			invocation("up", "openUpNext"),
			{ ...invocation("search", "searchTitles"), params: { query: "Alien" } },
			{
				...invocation("invalid", "openTimedPickForMe"),
				params: { minutes: 0 },
			},
			invocation("unknown", "unknown"),
		]);
		expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith({
			pathname: "/search",
			params: { q: "Alien", shortcutRequest: "search" },
		});
		expect(mocks.remove.mock.calls.map(([id]) => id)).toEqual([
			"up",
			"search",
			"invalid",
		]);
	});
	it("does not mount an Apple consumer on Android", async () => {
		mocks.platform = "android";
		await renderReady();
		expect(mocks.handler).toBeUndefined();
	});
});
