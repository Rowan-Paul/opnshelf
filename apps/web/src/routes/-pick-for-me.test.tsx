import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Picker, Route } from "./pick-for-me";

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	result: false,
	search: {} as {
		minutes?: number;
		filters?: string;
		type?: "both" | "movie" | "show";
	},
	data: {
		genres: [],
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
	},
	request: undefined as unknown,
}));
vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router",
	)),
	useNavigate: () => mocks.navigate,
	useLocation: () => mocks.result,
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/pick-for-me">{children}</a>
	),
}));
vi.mock("@tanstack/react-query", async () => ({
	...(await vi.importActual<typeof import("@tanstack/react-query")>(
		"@tanstack/react-query",
	)),
	useQuery: (options: { enabled: boolean; queryKey: unknown }) => {
		mocks.request = options.queryKey;
		return {
			data: options.enabled ? mocks.data : undefined,
			isFetching: false,
			isError: false,
		};
	},
}));
vi.mock("#/components/UpNextServiceFilter", () => ({
	UpNextServiceFilter: () => null,
}));
beforeEach(() => {
	localStorage.clear();
	mocks.result = false;
	mocks.search = {};
	mocks.navigate.mockReset();
	vi.spyOn(Route, "useSearch").mockImplementation(() => mocks.search);
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

it("navigates to a result screen with the submitted time and filters", async () => {
	render(<Picker userDid="did:plc:test" country="NL" savedIds={[8]} />);
	const submit = screen.getByRole("button", { name: "Pick for me" });
	await waitFor(() => expect(submit.hasAttribute("disabled")).toBe(false));
	fireEvent.change(screen.getByLabelText(/How much time do you have/), {
		target: { value: "150" },
	});
	fireEvent.change(screen.getByLabelText("Type"), {
		target: { value: "movie" },
	});
	fireEvent.click(submit);
	await waitFor(() =>
		expect(mocks.navigate).toHaveBeenLastCalledWith({
			to: "/pick-for-me/result",
			search: {
				minutes: 150,
				filters: JSON.stringify({
					type: "movie",
					progress: "both",
					genre: "",
					services: "8",
				}),
			},
		}),
	);
	expect(screen.queryByText("Tonight’s movie")).toBeNull();
});

it("restores a direct result request and supports skip exhaustion and reset", async () => {
	mocks.result = true;
	mocks.search = {
		minutes: 150,
		filters: JSON.stringify({
			type: "movie",
			progress: "both",
			genre: "Drama",
		}),
	};
	render(<Picker userDid="did:plc:test" country="NL" savedIds={[8]} />);
	await screen.findByText("Tonight’s movie");
	expect(screen.queryByLabelText(/How much time do you have/)).toBeNull();
	expect(screen.getByText("30 minutes left", { exact: false })).toBeTruthy();
	expect(JSON.stringify(mocks.request)).toContain('"genre":"Drama"');
	const status = screen.getByRole("status");
	const pickAgain = screen.getByRole("button", { name: "Pick again" });
	expect(document.activeElement).toBe(document.body);
	pickAgain.focus();
	fireEvent.click(pickAgain);
	expect(screen.getByText("You’ve tried every match")).toBeTruthy();
	const reset = screen.getByRole("button", { name: "Reset skips" });
	expect(document.activeElement).toBe(reset);
	expect(screen.getByRole("status")).toBe(status);
	expect(screen.getByRole("status").textContent).toContain(
		"You’ve tried every match",
	);
	fireEvent.click(reset);
	expect(screen.getByText("Tonight’s movie")).toBeTruthy();
	expect(document.activeElement).toBe(
		screen.getByRole("button", { name: "Pick again" }),
	);
	expect(screen.getByRole("status").textContent).toContain("Tonight’s movie");
	expect(screen.getByRole("link", { name: "Change filters" })).toBeTruthy();
});

it("prefills a variable budget and media type from the same picker URL", async () => {
	mocks.search = { minutes: 45, type: "show" };
	render(<Picker userDid="did:plc:picker-test" country="NL" savedIds={[8]} />);
	await waitFor(() =>
		expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe(
			"45",
		),
	);
	await waitFor(() =>
		expect(
			screen
				.getByRole("button", { name: "Pick for me" })
				.hasAttribute("disabled"),
		).toBe(false),
	);
	fireEvent.click(screen.getByRole("button", { name: "Pick for me" }));
	await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
	expect(
		JSON.parse(mocks.navigate.mock.calls.at(-1)?.[0].search.filters),
	).toMatchObject({ type: "show", services: "8" });
});
