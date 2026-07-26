import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MilkdownWebView } from "./MilkdownWebView";

const webViewMock = vi.hoisted(() => ({
	props: null as Record<string, unknown> | null,
	injectJavaScript: vi.fn(),
}));

vi.mock("react-native", async () => {
	const React = await import("react");
	return {
		View: ({ children }: { children: React.ReactNode }) =>
			React.createElement(React.Fragment, null, children),
	};
});

vi.mock("react-native-webview", async () => {
	const React = await import("react");
	return {
		WebView: React.forwardRef((props: Record<string, unknown>, ref) => {
			React.useImperativeHandle(ref, () => ({
				injectJavaScript: webViewMock.injectJavaScript,
			}));
			webViewMock.props = props;
			return null;
		}),
	};
});

vi.mock("@/lib/env", () => ({
	env: { siteUrl: "https://opnshelf.xyz" },
}));

vi.mock("@/lib/theme-context", () => ({
	useTheme: () => ({ scheme: "dark" }),
}));

function renderEditor(onChange = vi.fn()) {
	const rendered: { current?: ReactTestRenderer } = {};
	act(() => {
		rendered.current = create(
			<MilkdownWebView value="Initial **review**" onChange={onChange} />,
		);
	});
	if (!rendered.current) throw new Error("Editor was not rendered");
	return { renderer: rendered.current, onChange };
}

function webViewProp<T>(name: string): T {
	if (!webViewMock.props) throw new Error("WebView was not rendered");
	return webViewMock.props[name] as T;
}

describe("MilkdownWebView trust boundary", () => {
	beforeEach(() => {
		webViewMock.props = null;
		webViewMock.injectJavaScript.mockReset();
	});

	it("wires the WebView to only the trusted origin and editor route", () => {
		const { renderer } = renderEditor();

		expect(webViewProp("originWhitelist")).toEqual(["https://opnshelf.xyz"]);
		expect(webViewProp("source")).toEqual({
			uri: "https://opnshelf.xyz/embed/review-editor?theme=dark",
		});
		expect(webViewProp("setSupportMultipleWindows")).toBe(false);
		expect(webViewProp("scrollEnabled")).toBe(false);

		const shouldLoad = webViewProp<(request: { url: string }) => boolean>(
			"onShouldStartLoadWithRequest",
		);
		expect(
			shouldLoad({
				url: "https://opnshelf.xyz/embed/review-editor?theme=light",
			}),
		).toBe(true);
		expect(
			shouldLoad({ url: "https://opnshelf.xyz/embed/review-editor/other" }),
		).toBe(false);
		expect(
			shouldLoad({
				url: "https://opnshelf.xyz.evil.example/embed/review-editor",
			}),
		).toBe(false);
		expect(
			shouldLoad({ url: "https://evil.example/embed/review-editor" }),
		).toBe(false);
		expect(shouldLoad({ url: "not a url" })).toBe(false);

		act(() => renderer.unmount());
	});

	it("accepts ready and change messages only from the trusted editor", () => {
		const { renderer, onChange } = renderEditor();
		const onMessage =
			webViewProp<
				(event: { nativeEvent: { url: string; data: string } }) => void
			>("onMessage");

		onMessage({
			nativeEvent: {
				url: "https://opnshelf.xyz/embed/review-editor?theme=dark",
				data: JSON.stringify({ type: "ready" }),
			},
		});
		expect(webViewMock.injectJavaScript).toHaveBeenCalledOnce();
		expect(webViewMock.injectJavaScript).toHaveBeenCalledWith(
			'window.opnshelfSetMarkdown("Initial **review**"); true;',
		);

		onMessage({
			nativeEvent: {
				url: "https://opnshelf.xyz/embed/review-editor#selection",
				data: JSON.stringify({ type: "change", markdown: "Changed" }),
			},
		});
		expect(onChange).toHaveBeenCalledOnce();
		expect(onChange).toHaveBeenCalledWith("Changed");

		act(() => renderer.unmount());
	});

	// Regression (#177): Android's WebMessageListener delivers the bare source
	// origin instead of the page URL, so a pathname-scoped message guard dropped
	// "ready" and the editor never got seeded — an empty editor on every open.
	it("seeds the editor when Android reports only the source origin", () => {
		const { renderer } = renderEditor();
		const onMessage =
			webViewProp<
				(event: { nativeEvent: { url: string; data: string } }) => void
			>("onMessage");

		onMessage({
			nativeEvent: {
				url: "https://opnshelf.xyz",
				data: JSON.stringify({ type: "ready" }),
			},
		});

		expect(webViewMock.injectJavaScript).toHaveBeenCalledWith(
			'window.opnshelfSetMarkdown("Initial **review**"); true;',
		);
		act(() => renderer.unmount());
	});

	it("rejects foreign, lookalike, and malformed messages", () => {
		const { renderer, onChange } = renderEditor();
		const onMessage =
			webViewProp<
				(event: { nativeEvent: { url: string; data: string } }) => void
			>("onMessage");

		// Same-origin sibling routes are *not* in this list: messages can only be
		// trusted at origin granularity (see the Android case above), and the
		// WebView can never navigate off the editor route to reach one.
		for (const url of [
			"https://evil.example/embed/review-editor",
			"https://opnshelf.xyz.evil.example/embed/review-editor",
			"http://opnshelf.xyz/embed/review-editor",
			"https://user@opnshelf.xyz/embed/review-editor",
			"not a url",
		]) {
			onMessage({
				nativeEvent: {
					url,
					data: JSON.stringify({ type: "change", markdown: "Spoofed" }),
				},
			});
		}
		onMessage({
			nativeEvent: {
				url: "https://opnshelf.xyz/embed/review-editor",
				data: "not json",
			},
		});
		onMessage({
			nativeEvent: {
				url: "https://opnshelf.xyz/embed/review-editor",
				data: JSON.stringify({ type: "change", markdown: 42 }),
			},
		});

		expect(onChange).not.toHaveBeenCalled();
		expect(webViewMock.injectJavaScript).not.toHaveBeenCalled();
		act(() => renderer.unmount());
	});
});
