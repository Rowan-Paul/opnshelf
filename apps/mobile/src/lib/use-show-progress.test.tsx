import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ShowProgressScope,
	useShowProgress,
	useShowProgressForShow,
} from "./use-show-progress";

const api = vi.hoisted(() => ({ getProgress: vi.fn() }));

vi.mock("@opnshelf/api", () => ({
	showsControllerGetShowProgress: api.getProgress,
}));

vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true, user: { did: "did:plc:viewer" } }),
}));

function ShowCard({ showId }: { showId: string }) {
	const progress = useShowProgressForShow(showId);
	return createElement(
		"progress-card" as never,
		{ showId },
		progress.data?.items.find((item) => item.showId === showId)
			?.episodesWatched ?? "loading",
	);
}

function ShowGrid(): ReactNode {
	return (
		<ShowProgressScope showIds={["one", "two"]}>
			<ShowCard showId="one" />
			<ShowCard showId="two" />
		</ShowProgressScope>
	);
}

function ProgressErrorProbe() {
	const progress = useShowProgress(["broken"]);
	return createElement(
		"progress-error" as never,
		null,
		progress.isError ? "error" : progress.data ? "data" : "no-data",
	);
}

describe("show progress scopes", () => {
	afterEach(() => api.getProgress.mockReset());

	it("makes one grid batch request and gives each child its own server progress", async () => {
		api.getProgress.mockResolvedValue({
			data: {
				items: [
					{ showId: "one", episodesWatched: 1, episodesTotal: 3, seasons: [] },
					{ showId: "two", episodesWatched: 2, episodesTotal: 4, seasons: [] },
				],
			},
		});
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false, gcTime: Infinity } },
		});
		let renderer: ReactTestRenderer | undefined;

		act(() => {
			renderer = create(
				<QueryClientProvider client={client}>
					<ShowGrid />
				</QueryClientProvider>,
			);
		});
		if (!renderer) throw new Error("The progress grid did not render");
		const root = renderer.root;
		await act(async () => {
			await vi.waitFor(() => expect(api.getProgress).toHaveBeenCalledTimes(1));
			await vi.waitFor(() =>
				expect(
					root
						.findAllByType("progress-card" as never)
						.map((card) => card.children.join("")),
				).toEqual(["1", "2"]),
			);
		});

		expect(api.getProgress).toHaveBeenCalledWith({
			body: { showIds: ["one", "two"] },
			throwOnError: true,
		});
		client.clear();
	});

	it("keeps a failed request as an error instead of empty progress", async () => {
		api.getProgress.mockRejectedValue(new Error("Service unavailable"));
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false, gcTime: Infinity } },
		});
		let renderer: ReactTestRenderer | undefined;

		act(() => {
			renderer = create(
				<QueryClientProvider client={client}>
					<ProgressErrorProbe />
				</QueryClientProvider>,
			);
		});
		if (!renderer) throw new Error("The error probe did not render");
		const root = renderer.root;

		await act(async () => {
			await vi.waitFor(() =>
				expect(
					root.findByType("progress-error" as never).children.join(""),
				).toBe("error"),
			);
		});
		expect(api.getProgress).toHaveBeenCalledWith({
			body: { showIds: ["broken"] },
			throwOnError: true,
		});
		client.clear();
	});
});
