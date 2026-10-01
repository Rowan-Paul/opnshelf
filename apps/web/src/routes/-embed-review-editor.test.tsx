import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Route } from "./embed.review-editor";

const host = window as unknown as {
	ReactNativeWebView?: { postMessage: (message: string) => void };
	opnshelfSetMarkdown?: (markdown: string) => void;
	opnshelfFocusEditor?: () => void;
};

afterEach(() => {
	cleanup();
	delete host.ReactNativeWebView;
});

it("queues native focus until the actual Milkdown body mounts, preserving its draft", async () => {
	const postMessage = vi.fn();
	host.ReactNativeWebView = { postMessage };
	const Page = Route.options.component;
	if (!Page) throw new Error("Missing embedded editor route");
	render(<Page />);
	await waitFor(() =>
		expect(postMessage).toHaveBeenCalledWith('{"type":"ready"}'),
	);
	act(() => {
		host.opnshelfSetMarkdown?.("Keep my **draft**");
		host.opnshelfFocusEditor?.();
	});
	await waitFor(
		() => {
			const body = document.querySelector(".ProseMirror");
			expect(body).not.toBeNull();
			expect(document.activeElement).toBe(body);
			expect(body?.textContent).toBe("Keep my draft");
		},
		{ timeout: 5000 },
	);
	const title = document.createElement("input");
	document.body.append(title);
	title.focus();
	expect(document.activeElement).toBe(title);
	act(() => host.opnshelfFocusEditor?.());
	expect(document.activeElement).toBe(document.querySelector(".ProseMirror"));
	title.remove();
	act(() => {
		host.opnshelfSetMarkdown?.("A different review");
		host.opnshelfFocusEditor?.();
	});
	await waitFor(() => {
		expect(document.activeElement).toBe(document.querySelector(".ProseMirror"));
		expect(document.activeElement?.textContent).toBe("A different review");
	});
	cleanup();
	expect(host.opnshelfFocusEditor).toBeUndefined();
	expect(host.opnshelfSetMarkdown).toBeUndefined();
}, 10000);
