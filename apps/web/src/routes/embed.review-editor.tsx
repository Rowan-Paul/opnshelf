import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

// The same WYSIWYG Milkdown editor the web ReviewDialog uses. Rendered here in a
// chromeless page so the mobile app can host it in a WebView and get exact
// markdown round-trip parity with web (see ADR-0013 / the mobile MilkdownWebView).
// Client-only — Milkdown/ProseMirror cannot render during SSR.
const MarkdownEditor = lazy(() => import("#/components/MarkdownEditor"));

export const Route = createFileRoute("/embed/review-editor")({
	component: EmbedReviewEditor,
});

interface NativeBridge {
	postMessage: (data: string) => void;
}

function postToNative(message: Record<string, unknown>) {
	const bridge = (window as unknown as { ReactNativeWebView?: NativeBridge })
		.ReactNativeWebView;
	bridge?.postMessage(JSON.stringify(message));
}

/**
 * Bridge protocol with the RN WebView (see mobile MilkdownWebView):
 *   page → native:  { type: "ready" }             once the page can accept input
 *                    { type: "change", markdown }  on every edit
 *   native → page:  window.opnshelfSetMarkdown(md) to seed the initial body
 *
 * The editor only mounts after the initial markdown arrives (so it round-trips
 * the stored body). Opened directly in a browser (no RN bridge), it seeds empty
 * immediately so the page is still previewable.
 */
function EmbedReviewEditor() {
	const [initial, setInitial] = useState<string | null>(null);
	const [mounted, setMounted] = useState(false);
	const editorKey = useRef(0);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted) return;

		// Optional theme override from the host (?theme=dark|light). Without it the
		// inline root theme script falls back to prefers-color-scheme.
		const theme = new URLSearchParams(window.location.search).get("theme");
		if (theme === "dark" || theme === "light") {
			document.documentElement.classList.remove("light", "dark");
			document.documentElement.classList.add(theme);
			document.documentElement.style.colorScheme = theme;
		}

		// Native seeds the body once; remount the editor (key bump) so it re-parses.
		(
			window as unknown as { opnshelfSetMarkdown?: (md: string) => void }
		).opnshelfSetMarkdown = (md: string) => {
			editorKey.current += 1;
			setInitial(md ?? "");
		};

		const hasNative = !!(
			window as unknown as { ReactNativeWebView?: NativeBridge }
		).ReactNativeWebView;
		if (hasNative) {
			postToNative({ type: "ready" });
		} else {
			// Browser preview / direct open: no bridge, start with an empty editor.
			setInitial("");
		}
	}, [mounted]);

	return (
		<div className="min-h-screen bg-(--background) p-3">
			{mounted && initial !== null ? (
				<Suspense fallback={<div className="input min-h-[240px]" />}>
					<MarkdownEditor
						key={editorKey.current}
						value={initial}
						onChange={(markdown) => postToNative({ type: "change", markdown })}
					/>
				</Suspense>
			) : (
				<div className="input min-h-[240px]" />
			)}
		</div>
	);
}
