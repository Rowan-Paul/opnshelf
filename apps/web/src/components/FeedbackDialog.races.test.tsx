import {
	QueryClient,
	QueryClientProvider,
	useMutation,
} from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deferredCalls, step } from "#/test/async-races";
import { FeedbackDialog } from "./FeedbackDialog";

// FeedbackDialog swaps its form for a thank-you when a send succeeds. These
// pin what a late send may and may not do to a dialog the user has since
// closed or reopened.

const mocks = vi.hoisted(() => ({
	send: undefined as unknown as ReturnType<typeof deferredCalls>,
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

// Wired like SearchCommandDialog: the parent owns `open` and the mutation.
function Harness() {
	const [open, setOpen] = useState(false);
	const send = useMutation({
		mutationKey: ["feedback", "submit"],
		mutationFn: mocks.send.fn,
	});
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				Open feedback
			</button>
			<FeedbackDialog
				open={open}
				onOpenChange={setOpen}
				onSubmit={async (data) => {
					await send.mutateAsync(data);
				}}
				isSubmitting={send.isPending}
			/>
		</>
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.send = deferredCalls();
	render(
		<QueryClientProvider client={new QueryClient()}>
			<Harness />
		</QueryClientProvider>,
	);
});
afterEach(cleanup);

const message = () =>
	screen.getByPlaceholderText(
		"Describe your issue or idea...",
	) as HTMLTextAreaElement;
const openDialog = () =>
	step(() => fireEvent.click(screen.getByText("Open feedback")));
const type = (text: string) =>
	step(() => fireEvent.change(message(), { target: { value: text } }));
const send = () =>
	step(() => fireEvent.click(screen.getByRole("button", { name: /Send/ })));
// Cancel is disabled while sending; Escape still closes.
const close = () =>
	step(() =>
		fireEvent.keyDown(document.activeElement ?? document.body, {
			key: "Escape",
		}),
	);
const isOpen = () => screen.queryByRole("dialog") !== null;
const thanked = () =>
	screen.queryByText("Thank you for your feedback!") !== null;

it("opens a fresh form after a send finished while closed", async () => {
	await openDialog();
	await type("Older");
	await send();
	await close();
	expect(isOpen()).toBe(false);
	await step(() => mocks.send.calls[0].resolve({}));
	expect(mocks.toast.success).toHaveBeenCalledOnce();
	await openDialog();
	expect(thanked()).toBe(false);
	expect(message().value).toBe("");
});

it("leaves a reopened dialog alone when the earlier send finishes", async () => {
	await openDialog();
	await type("Older");
	await send();
	await close();
	await openDialog();
	await type("New draft");
	await step(() => mocks.send.calls[0].resolve({}));
	expect(isOpen()).toBe(true);
	expect(thanked()).toBe(false);
	expect(message().value).toBe("New draft");
	// The earlier feedback was still sent, so the user still hears about it.
	expect(mocks.toast.success).toHaveBeenCalledOnce();
});

it("still reports an earlier send that fails after closing", async () => {
	await openDialog();
	await type("Older");
	await send();
	await close();
	await step(() => mocks.send.calls[0].reject(new Error("Network")));
	// Each send is its own report, so a failure is news even once closed.
	expect(mocks.toast.error).toHaveBeenCalledOnce();
});

it("still thanks the user when a send finishes in the same opening", async () => {
	await openDialog();
	await type("Older");
	await send();
	await step(() => mocks.send.calls[0].resolve({}));
	expect(thanked()).toBe(true);
});
