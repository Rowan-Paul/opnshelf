import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ShowProgressScope,
	useShowProgress,
	useShowProgressForShow,
} from "./useShowProgress";

const mocks = vi.hoisted(() => ({
	getProgress: vi.fn(),
	auth: { isAuthenticated: true, user: { did: "did:plc:one" } },
}));

vi.mock("@opnshelf/api", () => ({
	showsControllerGetShowProgress: mocks.getProgress,
}));

vi.mock("#/lib/auth-context", () => ({
	useAuth: () => mocks.auth,
}));

function ShowCards() {
	return (
		<ShowProgressScope showIds={["one", "two"]}>
			<ShowCard showId="one" />
			<ShowCard showId="two" />
		</ShowProgressScope>
	);
}

function ShowCard({ showId }: { showId: string }) {
	const progress = useShowProgressForShow(showId);
	const item = progress.data?.items.find((entry) => entry.showId === showId);
	return (
		<output data-testid={`progress-${showId}`}>
			{item?.episodesWatched ?? "loading"}
		</output>
	);
}

function createQueryClient() {
	return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function ProgressProbe() {
	const progress = useShowProgress(["viewer-switch"]);
	return (
		<output>{progress.data?.items[0]?.episodesWatched ?? "loading"}</output>
	);
}

function ProgressErrorProbe() {
	const progress = useShowProgress(["broken"]);
	return (
		<output>
			{progress.isError ? "error" : progress.data ? "data" : "no-data"}
		</output>
	);
}

describe("useShowProgress", () => {
	afterEach(() => {
		cleanup();
		mocks.getProgress.mockReset();
		mocks.auth = { isAuthenticated: true, user: { did: "did:plc:one" } };
	});

	it("coalesces multiple mounted cards into one batch request", async () => {
		mocks.getProgress.mockResolvedValue({
			data: {
				items: [
					{ showId: "one", episodesWatched: 1, episodesTotal: 2, seasons: [] },
					{ showId: "two", episodesWatched: 0, episodesTotal: 4, seasons: [] },
				],
			},
		});

		render(
			<QueryClientProvider client={createQueryClient()}>
				<ShowCards />
			</QueryClientProvider>,
		);

		await waitFor(() => expect(mocks.getProgress).toHaveBeenCalledTimes(1));
		expect(mocks.getProgress).toHaveBeenCalledWith({
			body: { showIds: ["one", "two"] },
			throwOnError: true,
		});
		await waitFor(() =>
			expect(screen.getByTestId("progress-one").textContent).toBe("1"),
		);
		expect(screen.getByTestId("progress-two").textContent).toBe("0");
	});

	it("keeps a failed request as an error instead of empty progress", async () => {
		mocks.getProgress.mockRejectedValue(new Error("Service unavailable"));

		render(
			<QueryClientProvider client={createQueryClient()}>
				<ProgressErrorProbe />
			</QueryClientProvider>,
		);

		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toBe("error"),
		);
		expect(mocks.getProgress).toHaveBeenCalledWith({
			body: { showIds: ["broken"] },
			throwOnError: true,
		});
	});

	it("does not expose one viewer's cached progress after identity changes", async () => {
		mocks.auth = { isAuthenticated: true, user: { did: "did:plc:alice" } };
		mocks.getProgress.mockResolvedValueOnce({
			data: {
				items: [
					{
						showId: "viewer-switch",
						episodesWatched: 2,
						episodesTotal: 10,
						seasons: [],
					},
				],
			},
		});
		const client = createQueryClient();
		const view = render(
			<QueryClientProvider client={client}>
				<ProgressProbe />
			</QueryClientProvider>,
		);
		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toBe("2"),
		);

		mocks.auth = { isAuthenticated: true, user: { did: "did:plc:bob" } };
		mocks.getProgress.mockResolvedValueOnce({
			data: {
				items: [
					{
						showId: "viewer-switch",
						episodesWatched: 0,
						episodesTotal: 10,
						seasons: [],
					},
				],
			},
		});
		view.rerender(
			<QueryClientProvider client={client}>
				<ProgressProbe />
			</QueryClientProvider>,
		);

		expect(screen.getByRole("status").textContent).toBe("loading");
		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toBe("0"),
		);
		expect(mocks.getProgress).toHaveBeenCalledTimes(2);
	});
});
