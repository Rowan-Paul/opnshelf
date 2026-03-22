import type { GatekeeperConfig } from "./config.js";

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function renderSignupPage(
	config: Pick<GatekeeperConfig, "pdsHostname" | "turnstileExpectedAction" | "turnstileSiteKey">,
	options: {
		handle: string;
		state: string;
		errorMessage?: string;
		redirectUrl?: string;
	},
): string {
	const errorBlock = options.errorMessage
		? `<p class="message message-error">${escapeHtml(options.errorMessage)}</p>`
		: "";
	const redirectInput = options.redirectUrl
		? `<input type="hidden" name="redirect_url" value="${escapeHtml(options.redirectUrl)}" />`
		: "";

	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(config.pdsHostname)} signup verification</title>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f4f1ea;
      --panel: rgba(255, 255, 255, 0.9);
      --ink: #1f1a14;
      --muted: #675d52;
      --accent: #0f766e;
      --accent-strong: #115e59;
      --error-bg: rgba(185, 28, 28, 0.08);
      --error-ink: #991b1b;
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #161311;
        --panel: rgba(31, 24, 20, 0.92);
        --ink: #f6eee5;
        --muted: #d1c4b2;
        --accent: #5eead4;
        --accent-strong: #99f6e4;
        --error-bg: rgba(248, 113, 113, 0.16);
        --error-ink: #fecaca;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top, rgba(15, 118, 110, 0.15), transparent 36%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent),
        var(--bg);
      color: var(--ink);
    }
    .shell {
      width: min(100%, 560px);
      background: var(--panel);
      border: 1px solid rgba(120, 98, 76, 0.16);
      border-radius: 28px;
      padding: 32px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.12);
      backdrop-filter: blur(12px);
    }
    .eyebrow {
      margin: 0 0 8px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-size: 0.78rem;
      color: var(--muted);
    }
    h1 {
      margin: 0;
      font-size: clamp(2rem, 5vw, 3rem);
      line-height: 0.96;
    }
    .lede {
      margin: 16px 0 24px;
      font-size: 1rem;
      line-height: 1.6;
      color: var(--muted);
    }
    .meta {
      display: grid;
      gap: 6px;
      margin: 0 0 24px;
      padding: 16px 18px;
      border-radius: 18px;
      background: rgba(15, 118, 110, 0.08);
    }
    .meta strong {
      font-size: 0.86rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent-strong);
    }
    .message {
      margin: 18px 0 0;
      padding: 12px 14px;
      border-radius: 14px;
      line-height: 1.5;
    }
    .message-error {
      background: var(--error-bg);
      color: var(--error-ink);
    }
    .submit-note {
      margin: 18px 0 0;
      font-size: 0.95rem;
      color: var(--muted);
    }
    .cf-turnstile {
      min-height: 70px;
    }
  </style>
</head>
<body>
  <main class="shell">
    <p class="eyebrow">Protected signup</p>
    <h1>Verify you’re human.</h1>
    <p class="lede">
      Complete the Turnstile check for <strong>${escapeHtml(options.handle)}</strong>.
      Once approved, you’ll be sent back to finish account creation on ${escapeHtml(config.pdsHostname)}.
    </p>
    <section class="meta">
      <strong>Why this exists</strong>
      <span>This PDS uses a short-lived verification code to slow down automated signups without changing the ATProto account creation flow.</span>
    </section>
    <form id="gate-form" method="POST" action="">
      <input type="hidden" name="state" value="${escapeHtml(options.state)}" />
      ${redirectInput}
      <div
        class="cf-turnstile"
        data-sitekey="${escapeHtml(config.turnstileSiteKey)}"
        data-action="${escapeHtml(config.turnstileExpectedAction)}"
        data-theme="auto"
        data-callback="onTurnstileSuccess"
        data-error-callback="onTurnstileError"
        data-expired-callback="onTurnstileExpired"
      ></div>
    </form>
    <p class="submit-note">The form submits automatically after a successful check.</p>
    ${errorBlock}
  </main>
  <script>
    function updateError(message) {
      const url = new URL(window.location.href);
      url.searchParams.set("error", message);
      window.location.assign(url.toString());
    }

    function onTurnstileSuccess() {
      window.setTimeout(function () {
        document.getElementById("gate-form").submit();
      }, 200);
    }

    function onTurnstileError() {
      updateError("Verification failed. Please try again.");
    }

    function onTurnstileExpired() {
      updateError("Verification expired. Please try again.");
    }
  </script>
</body>
</html>`;
}
