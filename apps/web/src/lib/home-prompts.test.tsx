import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useEligibleAtMount } from "./home-prompts";

afterEach(cleanup);

const KEY = ["prompt"];
type Answer = { eligible: boolean } | undefined;

function Prompt() {
	const eligible = useEligibleAtMount(KEY, (data: Answer) =>
		Boolean(data?.eligible),
	);
	return <p>{eligible ? "shown" : "held"}</p>;
}

function renderWith(client: QueryClient) {
	return render(
		<QueryClientProvider client={client}>
			<Prompt />
		</QueryClientProvider>,
	);
}

it("shows a prompt whose cached answer was eligible when it mounted", () => {
	const client = new QueryClient();
	client.setQueryData(KEY, { eligible: true });
	renderWith(client);
	expect(screen.getByText("shown")).toBeTruthy();
});

it("holds a prompt whose answer arrives after it mounted, instead of shifting the page", async () => {
	const client = new QueryClient();
	renderWith(client);
	await act(async () => {
		client.setQueryData(KEY, { eligible: true });
	});
	expect(screen.getByText("held")).toBeTruthy();
});

it("holds a prompt a refetch makes eligible after a cached ineligible answer", async () => {
	const client = new QueryClient();
	client.setQueryData(KEY, { eligible: false });
	renderWith(client);
	await act(async () => {
		client.setQueryData(KEY, { eligible: true });
	});
	expect(screen.getByText("held")).toBeTruthy();
});
