import { useRef } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { env } from "@/lib/env";
import {
	isTrustedEditorMessageOrigin,
	isTrustedEditorUrl,
	trustedEditorOrigin,
	trustedEditorUrl,
} from "@/lib/safe-links";
import { useTheme } from "@/lib/theme-context";

interface MilkdownWebViewProps {
	/** Initial markdown, injected once after the page signals it is ready. */
	value: string;
	/** Fires with the serialized markdown on every edit inside the WebView. */
	onChange: (markdown: string) => void;
}

/**
 * The web app's Milkdown WYSIWYG editor, hosted in a WebView (ADR-0013). The
 * editor lives at `${siteUrl}/embed/review-editor` so mobile reuses the *exact*
 * same editor and markdown serializer as web — a review edited here round-trips
 * to identical markdown, no second implementation to drift. Requires network
 * (writing a review already hits the PDS), and editor changes ship with the web
 * deploy, not a mobile release.
 *
 * Bridge protocol (mirrors the embed route):
 *   page → native:  { type: "ready" } | { type: "change", markdown }
 *   native → page:  window.opnshelfSetMarkdown(md)
 */
export function MilkdownWebView({ value, onChange }: MilkdownWebViewProps) {
	const { scheme } = useTheme();
	const webRef = useRef<WebView>(null);
	// Capture the initial body once; parent re-renders (on each change) must not
	// re-seed the editor and clobber what the user is typing.
	const initial = useRef(value);
	const uri = trustedEditorUrl(env.siteUrl, scheme);
	const editorOrigin = trustedEditorOrigin(env.siteUrl);

	const handleMessage = (event: WebViewMessageEvent) => {
		// Origin-only: Android reports the source origin without a pathname here.
		if (!isTrustedEditorMessageOrigin(event.nativeEvent.url, env.siteUrl))
			return;
		let msg: { type?: string; markdown?: string };
		try {
			msg = JSON.parse(event.nativeEvent.data);
		} catch {
			return;
		}
		if (msg.type === "ready") {
			// Seed the stored body; JSON.stringify safely escapes it for injection.
			webRef.current?.injectJavaScript(
				`window.opnshelfSetMarkdown(${JSON.stringify(initial.current)}); true;`,
			);
		} else if (msg.type === "change" && typeof msg.markdown === "string") {
			onChange(msg.markdown);
		}
	};

	if (!uri || !editorOrigin) return null;

	return (
		<View className="min-h-48 flex-1 overflow-hidden rounded-lg border border-border">
			<WebView
				ref={webRef}
				originWhitelist={[editorOrigin]}
				source={{ uri }}
				onShouldStartLoadWithRequest={(request) =>
					isTrustedEditorUrl(request.url, env.siteUrl)
				}
				onMessage={handleMessage}
				setSupportMultipleWindows={false}
				// iOS: allow the editor to focus + raise the keyboard without a
				// preceding user tap being required by WebKit.
				keyboardDisplayRequiresUserAction={false}
				hideKeyboardAccessoryView
				androidLayerType="software"
				style={{ backgroundColor: "transparent" }}
			/>
		</View>
	);
}
