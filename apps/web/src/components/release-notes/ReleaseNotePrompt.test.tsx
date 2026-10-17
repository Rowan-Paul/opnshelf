import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReleaseNotePrompt } from "./ReleaseNotePrompt";

const state = vi.hoisted(() => ({
	user: { did: "reader" } as { did: string } | null,
	notes: {
		unread: true,
		isPending: false,
		readPending: false,
		data: [
			{
				slug: "latest",
				title: "New tracking controls",
				summary: "Choose how you track.",
			},
		],
	},
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ user: state.user }),
}));
vi.mock("#/lib/use-release-notes", () => ({
	useReleaseNotes: () => state.notes,
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({
		params,
		children,
		onClick,
	}: {
		params: { slug: string };
		children: ReactNode;
		onClick: () => void;
	}) => (
		<a
			href={`/whats-new/${params.slug}`}
			onClick={(event) => {
				event.preventDefault();
				onClick();
			}}
		>
			{children}
		</a>
	),
}));
beforeEach(() => {
	localStorage.clear();
	state.user = { did: "reader" };
	state.notes.unread = true;
	state.notes.isPending = false;
	state.notes.readPending = false;
	state.notes.data[0].slug = "latest";
});
afterEach(cleanup);

it("links to the announcement and remembers opening it without clearing unread state", () => {
	const view = render(<ReleaseNotePrompt />);
	const link = screen.getByRole("link", { name: "Read what’s new" });
	expect(link.getAttribute("href")).toBe("/whats-new/latest");
	fireEvent.click(link);
	expect(screen.queryByText("New tracking controls")).toBeNull();
	view.unmount();
	render(<ReleaseNotePrompt />);
	expect(screen.queryByText("New tracking controls")).toBeNull();
	expect(state.notes.unread).toBe(true);
});

it("scopes dismissal to the account and announcement", () => {
	const view = render(<ReleaseNotePrompt />);
	fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
	state.notes.data[0].slug = "newer";
	view.rerender(<ReleaseNotePrompt />);
	expect(screen.getByRole("link").getAttribute("href")).toBe(
		"/whats-new/newer",
	);
	state.notes.data[0].slug = "latest";
	state.user = { did: "another-reader" };
	view.rerender(<ReleaseNotePrompt />);
	expect(screen.getByRole("link")).toBeTruthy();
});

it("waits for feed and read state, and hides for signed-out or caught-up readers", () => {
	state.notes.readPending = true;
	const view = render(<ReleaseNotePrompt />);
	expect(screen.getByLabelText("Loading what’s new")).toBeTruthy();
	expect(screen.queryByRole("link")).toBeNull();
	state.notes.readPending = false;
	state.notes.unread = false;
	view.rerender(<ReleaseNotePrompt />);
	expect(view.container.childElementCount).toBe(0);
	state.notes.unread = true;
	state.user = null;
	view.rerender(<ReleaseNotePrompt />);
	expect(view.container.childElementCount).toBe(0);
});
