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
	onError,
}: {
	siteKey: string | undefined;
	onVerify: (token: string) => void;
	onExpire?: () => void;
	/**
	 * Fired when Turnstile errors inside the WebView. `code` is Cloudflare's
	 * error code (e.g. `110200` = domain not allowed) or one of our own markers
	 * (`script-load-failed`, `turnstile-undefined`, `render-threw`).
	 */
	onError?: (code: string) => void;
}) {
	const colorScheme = useColorScheme();
	// Keep the latest callbacks in refs so a re-render doesn't reload the WebView.
	const onVerifyRef = useRef(onVerify);
	const onExpireRef = useRef(onExpire);
	const onErrorRef = useRef(onError);
	onVerifyRef.current = onVerify;
	onExpireRef.current = onExpire;
	onErrorRef.current = onError;

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
				code?: string;
				message?: string;
			};
			switch (msg.type) {
				case "verify":
					if (typeof msg.token === "string") onVerifyRef.current(msg.token);
					break;
				case "expire":
					onExpireRef.current?.();
					break;
				case "error": {
					// Turnstile failed inside the WebView. The code never reaches Metro
					// on its own, so surface it here and clear any stale token.
					const code = msg.code ?? "unknown";
					console.warn(`[Turnstile] widget error (code ${code})`);
					onErrorRef.current?.(code);
					onExpireRef.current?.();
					break;
				}
				case "log":
					// Mirror the WebView's own console/errors into Metro for debugging.
					if (__DEV__) console.log(`[Turnstile webview] ${msg.message ?? ""}`);
					break;
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
				onError={({ nativeEvent }) =>
					console.warn("[Turnstile] webview load error", nativeEvent)
				}
				onHttpError={({ nativeEvent }) =>
					console.warn(
						`[Turnstile] webview http ${nativeEvent.statusCode} for ${nativeEvent.url}`,
					)
				}
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
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #cf { display: flex; justify-content: center; align-items: flex-start; }
</style>
<script>
  // The bridge + diagnostics are defined BEFORE the Cloudflare script loads so a
  // script-load failure or an early error is still reported back to RN.
  function post(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }
  window.onerror = function (message, src, line, col) {
    post({ type: 'log', message: 'onerror: ' + message + ' (' + line + ':' + col + ')' });
    return false;
  };
  ['log', 'warn', 'error'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      post({ type: 'log', message: '[' + level + '] ' + Array.prototype.join.call(arguments, ' ') });
      if (original) original.apply(console, arguments);
    };
  });
  window.onloadTurnstileCallback = function () {
    if (!window.turnstile) {
      post({ type: 'error', code: 'turnstile-undefined' });
      return;
    }
    try {
      turnstile.render('#cf', {
        sitekey: ${JSON.stringify(siteKey)},
        theme: ${JSON.stringify(theme)},
        callback: function (token) { post({ type: 'verify', token: token }); },
        'expired-callback': function () { post({ type: 'expire' }); },
        // Turnstile passes its error code here (e.g. 110200 = domain not allowed).
        'error-callback': function (code) { post({ type: 'error', code: String(code) }); }
      });
      post({ type: 'log', message: 'turnstile.render called (host=' + window.location.hostname + ')' });
    } catch (e) {
      post({ type: 'error', code: 'render-threw' });
      post({ type: 'log', message: 'render threw: ' + (e && e.message) });
    }
  };
</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit" async defer onerror="post({ type: 'error', code: 'script-load-failed' })"></script>
</head>
<body>
<div id="cf"></div>
</body>
</html>`;
}
