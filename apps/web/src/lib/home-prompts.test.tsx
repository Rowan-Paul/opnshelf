import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useReadyAtMount } from "./home-prompts";

afterEach(cleanup);

const KEY = ["prompt"];

function Prompt() {
	return <p>{useReadyAtMount(KEY) ? "shown" : "held"}</p>;
}

function renderWith(client: QueryClient) {
	return render(
		<QueryClientProvider client={client}>
			<Prompt />
		</QueryClientProvider>,
	);
}

it("shows a prompt whose answer was cached before it mounted", () => {
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
