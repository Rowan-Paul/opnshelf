import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HelpSection } from "./HelpSection";

const mocks = vi.hoisted(() => ({
	reset: vi.fn(),
	navigate: vi.fn(),
	error: vi.fn(),
}));
vi.mock("@opnshelf/api", () => ({
	authControllerMeQueryKey: () => ["me"],
	usersControllerResetOnboardingMutation: () => ({ mutationFn: mocks.reset }),
}));
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
vi.mock("#/components/tour/WelcomeTour", () => ({
	TOUR_REPLAY_EVENT: "tour-replay",
}));
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
function setup() {
	const client = new QueryClient({
		defaultOptions: { mutations: { retry: false } },
	});
	client.setQueryData(["me"], {
		displayName: "Viewer",
		needsOnboarding: false,
		onboardingCompletedAt: "2026-01-01",
	});
	render(
		<QueryClientProvider client={client}>
			<HelpSection />
		</QueryClientProvider>,
	);
	return client;
}
it("updates the account cache and opens onboarding after a successful reset", async () => {
	mocks.reset.mockResolvedValue(undefined);
	const client = setup();
	fireEvent.click(screen.getByRole("button", { name: "Reset onboarding" }));
	await waitFor(() =>
		expect(mocks.navigate).toHaveBeenCalledWith({ to: "/onboarding" }),
	);
	expect(client.getQueryData(["me"])).toEqual({
		displayName: "Viewer",
		needsOnboarding: true,
		onboardingCompletedAt: null,
	});
});
it("keeps the account and page unchanged when reset fails", async () => {
	mocks.reset.mockRejectedValue(new Error("Offline"));
	const client = setup();
	fireEvent.click(screen.getByRole("button", { name: "Reset onboarding" }));
	await waitFor(() => expect(mocks.error).toHaveBeenCalled());
	expect(mocks.navigate).not.toHaveBeenCalled();
	expect(client.getQueryData(["me"])).toMatchObject({ needsOnboarding: false });
});
