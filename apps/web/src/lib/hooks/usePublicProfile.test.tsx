import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePublicFollowers, usePublicFollowing } from "./usePublicProfile";

const mocks = vi.hoisted(() => ({
	followersOptions: vi.fn(),
	followingOptions: vi.fn(),
}));

vi.mock("@opnshelf/api", () => ({
	usersControllerGetPublicFollowersOptions: mocks.followersOptions,
	usersControllerGetPublicFollowingOptions: mocks.followingOptions,
}));

function createQueryClient() {
	return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function FollowersProbe() {
	const query = usePublicFollowers("rowan", 2, 10);
	return <output>{query.isError ? "error" : query.data?.items.length}</output>;
}

function FollowingProbe() {
	const query = usePublicFollowing("rowan", 3, 15);
	return <output>{query.isError ? "error" : query.data?.items.length}</output>;
}

describe("public profile connection hooks", () => {
	afterEach(() => {
		cleanup();
		mocks.followersOptions.mockReset();
		mocks.followingOptions.mockReset();
	});

	it("uses the generated followers options and exposes request failures", async () => {
		const requestError = new Error("request failed");
		mocks.followersOptions.mockReturnValue({
			queryKey: ["generated-followers"],
			queryFn: () => Promise.reject(requestError),
		});

		render(
			<QueryClientProvider client={createQueryClient()}>
				<FollowersProbe />
			</QueryClientProvider>,
		);

		expect(mocks.followersOptions).toHaveBeenCalledWith({
			path: { handle: "rowan" },
			query: { page: 2, pageSize: 10 },
		});
		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toBe("error"),
		);
	});

	it("uses the generated following options with its pagination", async () => {
		mocks.followingOptions.mockReturnValue({
			queryKey: ["generated-following"],
			queryFn: () => Promise.resolve({ items: [{ did: "did:plc:one" }] }),
		});

		render(
			<QueryClientProvider client={createQueryClient()}>
				<FollowingProbe />
			</QueryClientProvider>,
		);

		expect(mocks.followingOptions).toHaveBeenCalledWith({
			path: { handle: "rowan" },
			query: { page: 3, pageSize: 15 },
		});
		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toBe("1"),
		);
	});
});
