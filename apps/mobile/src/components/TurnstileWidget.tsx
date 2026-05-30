import { useEffect, useRef } from "react";
import { useColorScheme, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { env } from "@/lib/env";

/**
 * Cloudflare Turnstile captcha for React Native.
 *
 * Turnstile has no native SDK, so we host its web widget inside a WebView and
 * bridge the token back over `postMessage`. The document is loaded with a
 * `baseUrl` of the public site origin (`env.siteUrl`) so Turnstile sees a
 * hostname that matches the site key's allowed list — an empty/`about:blank`
 * origin would be rejected.
 *
 * When no site key is configured the widget renders nothing and reports an
 * empty token immediately. That mirrors the web widget and the backend, which
 * disables verification when `TURNSTILE_SECRET_KEY` is unset (local dev).
 */
export function TurnstileWidget({
	siteKey,
	onVerify,
	onExpire,
}: {
	siteKey: string | undefined;
	onVerify: (token: string) => void;
	onExpire?: () => void;
}) {
	const colorScheme = useColorScheme();
	// Keep the latest callbacks in refs so a re-render doesn't reload the WebView.
	const onVerifyRef = useRef(onVerify);
	const onExpireRef = useRef(onExpire);
	onVerifyRef.current = onVerify;
	onExpireRef.current = onExpire;

	useEffect(() => {
		if (!siteKey) {
			// No captcha configured (local dev): treat as a no-op pass.
			onVerifyRef.current("");
		}
	}, [siteKey]);

	if (!siteKey) return null;

	const theme = colorScheme === "dark" ? "dark" : "light";
	const html = buildHtml(siteKey, theme);

	const handleMessage = (event: WebViewMessageEvent) => {
		try {
			const msg = JSON.parse(event.nativeEvent.data) as {
				type?: string;
				token?: string;
			};
			if (msg.type === "verify" && typeof msg.token === "string") {
				onVerifyRef.current(msg.token);
			} else if (msg.type === "expire" || msg.type === "error") {
				onExpireRef.current?.();
			}
		} catch {
			// Ignore malformed bridge messages.
		}
	};

	return (
		<View className="h-[72px] w-full" collapsable={false}>
			<WebView
				originWhitelist={["*"]}
				source={{ html, baseUrl: env.siteUrl }}
				onMessage={handleMessage}
				scrollEnabled={false}
				androidLayerType="software"
				style={{ backgroundColor: "transparent" }}
			/>
		</View>
	);
}

/** Inline page that renders the Turnstile widget and posts its token back. */
function buildHtml(siteKey: string, theme: "light" | "dark"): string {
	return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit" async defer></script>
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #cf { display: flex; justify-content: center; align-items: flex-start; }
</style>
</head>
<body>
<div id="cf"></div>
<script>
  function post(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }
  window.onloadTurnstileCallback = function () {
    turnstile.render('#cf', {
      sitekey: ${JSON.stringify(siteKey)},
      theme: ${JSON.stringify(theme)},
      callback: function (token) { post({ type: 'verify', token: token }); },
      'expired-callback': function () { post({ type: 'expire' }); },
      'error-callback': function () { post({ type: 'error' }); }
    });
  };
</script>
</body>
</html>`;
}
