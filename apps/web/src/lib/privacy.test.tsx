import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePrivacy } from "../../../../packages/api/src/privacy";

const mocks = vi.hoisted(() => ({
	status: vi.fn(),
	allLists: vi.fn(),
	defaultVisibility: vi.fn(),
	authorize: vi.fn(),
}));
vi.mock("../../../../packages/api/src/generated/sdk.gen", () => ({
	privacyControllerStatus: mocks.status,
	privacyControllerChangeAllLists: mocks.allLists,
	privacyControllerListsDefault: mocks.defaultVisibility,
	privacyControllerChange: vi.fn(),
	privacyControllerRetry: vi.fn(),
}));
const status = {
	availability: "available",
	authorized: true,
	listsDefaultVisibility: "public",
	scopes: [],
	alphaDetails: "",
};
beforeEach(() => {
	vi.clearAllMocks();
	mocks.status.mockResolvedValue({ data: status });
	mocks.allLists.mockResolvedValue({ data: status });
	mocks.defaultVisibility.mockResolvedValue({ data: status });
	mocks.authorize.mockResolvedValue(true);
});
async function setup() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const hook = renderHook(() => usePrivacy(mocks.authorize), {
		wrapper: ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		),
	});
	await waitFor(() => expect(hook.result.current.query.isSuccess).toBe(true));
	return hook;
}
describe("Lists visibility scope", () => {
	it("updates the default after requesting migration of all existing Lists", async () => {
		const { result } = await setup();
		await act(() =>
			result.current.mutation.mutateAsync({
				kind: "allLists",
				body: {
					category: "lists",
					visibility: "public",
					publicationConfirmed: true,
				},
			}),
		);
		expect(mocks.allLists).toHaveBeenCalledOnce();
		expect(mocks.defaultVisibility).toHaveBeenCalledWith({
			body: { visibility: "public" },
			throwOnError: true,
		});
		expect(mocks.allLists.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.defaultVisibility.mock.invocationCallOrder[0],
		);
	});
	it("does not change the default when a bulk migration request fails", async () => {
		mocks.allLists.mockRejectedValueOnce(new Error("Migration unavailable"));
		const { result } = await setup();
		await act(async () => {
			await expect(
				result.current.mutation.mutateAsync({
					kind: "allLists",
					body: {
						category: "lists",
						visibility: "public",
						publicationConfirmed: true,
					},
				}),
			).rejects.toThrow("Migration unavailable");
		});
		expect(mocks.defaultVisibility).not.toHaveBeenCalled();
	});
	it("leaves both existing Lists and the default unchanged when authorization is declined", async () => {
		mocks.status.mockResolvedValue({ data: { ...status, authorized: false } });
		mocks.authorize.mockResolvedValue(false);
		const { result } = await setup();
		await act(() =>
			result.current.mutation.mutateAsync({
				kind: "allLists",
				body: { category: "lists", visibility: "private" },
			}),
		);
		expect(mocks.authorize).toHaveBeenCalledOnce();
		expect(mocks.allLists).not.toHaveBeenCalled();
		expect(mocks.defaultVisibility).not.toHaveBeenCalled();
	});
});
