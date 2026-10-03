import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YourActivity } from "#/components/YourActivity";
import { useWatchActions } from "./useWatchActions";

const mocks = vi.hoisted(() => ({
	updateMovie: vi.fn(),
	updateEpisode: vi.fn(),
}));
vi.mock("@opnshelf/api", async (importOriginal) => ({
	...(await importOriginal<typeof import("@opnshelf/api")>()),
	moviesControllerUpdateMovieWatchDateMutation: () => ({
		mutationFn: mocks.updateMovie,
	}),
	showsControllerUpdateEpisodeWatchDateMutation: () => ({
		mutationFn: mocks.updateEpisode,
	}),
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ isAuthenticated: true, user: { did: "did:plc:test" } }),
}));
vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function deferred() {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function History({ episode }: { episode: boolean }) {
	const actions = useWatchActions(
		episode
			? { mediaType: "show", showId: "42" }
			: { mediaType: "movie", movieId: "42" },
	);
	const save = episode
		? actions.updateEpisodeWatchDate
		: actions.updateMovieWatchDate;
	return (
		<>
			{["a", "b"].map((id) => (
				<button
					key={id}
					type="button"
					onClick={() => {
						void save(id, null).catch(() => {});
					}}
				>
					Save {id}
				</button>
			))}
			<YourActivity
				watchHistory={[{ id: "a" }, { id: "b" }, { id: "c" }]}
				onAddToShelf={() => {}}
				onDeleteEntry={() => {}}
				onEditEntry={save}
				updatingEntryIds={
					episode
						? actions.updatingEpisodeWatchIds
						: actions.updatingMovieWatchIds
				}
			/>
		</>
	);
}

describe("concurrent Watch date edits", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});
	it.each([
		{ episode: false, firstToSettle: 0 },
		{ episode: false, firstToSettle: 1 },
		{ episode: true, firstToSettle: 0 },
		{ episode: true, firstToSettle: 1 },
	])("keeps each row pending (episode=$episode, first settled=$firstToSettle)", async ({
		episode,
		firstToSettle,
	}) => {
		const requests = [deferred(), deferred()];
		const mutation = episode ? mocks.updateEpisode : mocks.updateMovie;
		mutation
			.mockImplementationOnce(() => requests[0].promise)
			.mockImplementationOnce(() => requests[1].promise);
		const client = new QueryClient({
			defaultOptions: { mutations: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<History episode={episode} />
			</QueryClientProvider>,
		);
		const expectPending = (pending: boolean[]) => {
			for (const label of ["Edit watch date", "Remove this watch"]) {
				const buttons = screen.getAllByRole<HTMLButtonElement>("button", {
					name: label,
				});
				expect(buttons.map((button) => button.disabled)).toEqual(pending);
			}
		};
		fireEvent.click(screen.getByText("Save a"));
		await waitFor(() => expectPending([true, false, false]));
		fireEvent.click(screen.getByText("Save b"));
		await waitFor(() => expectPending([true, true, false]));
		requests[firstToSettle].resolve();
		await waitFor(() =>
			expectPending(
				firstToSettle === 0 ? [false, true, false] : [true, false, false],
			),
		);
		requests[1 - firstToSettle].reject(new Error("Save failed"));
		await waitFor(() => expectPending([false, false, false]));
		client.clear();
	});
});
