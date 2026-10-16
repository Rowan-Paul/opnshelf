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
	change: vi.fn(),
}));
vi.mock("../../../../packages/api/src/generated/sdk.gen", () => ({
	privacyControllerStatus: mocks.status,
	privacyControllerChangeAllLists: mocks.allLists,
	privacyControllerListsDefault: mocks.defaultVisibility,
	privacyControllerChange: mocks.change,
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
	mocks.change.mockReset();
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
	it("uses one bulk request for the existing Lists and their default", async () => {
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
		expect(mocks.defaultVisibility).not.toHaveBeenCalled();
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

describe("privacy acceptance reconciliation", () => {
	it("shows the accepted migration if a duplicate request meets its worker lock", async () => {
		const { result } = await setup();
		const accepted = {
			...status,
			scopes: [
				{
					category: "watches",
					listRkey: null,
					label: "Watches",
					visibility: "private",
					migration: {
						id: "accepted",
						target: "public",
						status: "running",
						copied: 0,
						total: 3,
						error: null,
					},
				},
			],
		};
		mocks.status.mockResolvedValue({ data: accepted });
		mocks.change.mockRejectedValueOnce({
			statusCode: 409,
			message: "Another Watch operation is in progress. Try again.",
		});
		await act(() =>
			result.current.mutation.mutateAsync({
				kind: "change",
				body: {
					category: "watches",
					visibility: "public",
					publicationConfirmed: true,
				},
			}),
		);
		expect(result.current.mutation.isError).toBe(false);
		await waitFor(() =>
			expect(result.current.query.data?.scopes[0]?.migration?.id).toBe(
				"accepted",
			),
		);
		expect(mocks.change).toHaveBeenCalledOnce();
	});
	it("still reports contention when the requested change has not started", async () => {
		const { result } = await setup();
		mocks.change.mockRejectedValueOnce({
			statusCode: 409,
			message: "Another Watch operation is in progress. Try again.",
		});
		await act(async () => {
			await expect(
				result.current.mutation.mutateAsync({
					kind: "change",
					body: {
						category: "watches",
						visibility: "public",
						publicationConfirmed: true,
					},
				}),
			).rejects.toMatchObject({ statusCode: 409 });
		});
	});
});
