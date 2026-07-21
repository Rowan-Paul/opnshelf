# Plan 013: Restrict mobile review links and the editor WebView trust boundary

> **Executor instructions**: Follow the plan exactly and run every gate. Stop rather than broadening supported schemes or origins. Update the index when done unless the reviewer owns it.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- apps/mobile/src/components/ui/Markdown.tsx apps/mobile/src/components/detail/MilkdownWebView.tsx apps/mobile/src/lib/safe-links.ts apps/mobile/src/lib/safe-links.test.ts apps/mobile/src/components/detail/MilkdownWebView.test.tsx`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/009-establish-mobile-test-baseline.md`
- **Category**: security
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

User-authored Markdown currently passes any parsed scheme to the OS, including custom application schemes. The Milkdown editor WebView permits every origin and accepts bridge messages without checking the sender URL, so a navigation away from the trusted editor can retain a native message channel. Limit public links to web URLs and bind navigation plus bridge processing to the configured site origin and editor route.

## Current state

- `apps/mobile/src/components/ui/Markdown.tsx:75-83` directly calls `Linking.openURL(linkUrl)` for any regex-matched URL.
- `apps/mobile/src/components/detail/MilkdownWebView.tsx:32-57` builds `${env.siteUrl}/embed/review-editor` but uses:

```tsx
<WebView
	originWhitelist={["*"]}
	source={{ uri }}
	onMessage={handleMessage}
/>
```

- `handleMessage` parses `event.nativeEvent.data` but does not validate `event.nativeEvent.url` before handling `ready` or `change`.
- ADR-0013's documented constraint, quoted in the component, is that mobile reuses the web editor at `/embed/review-editor`; this plan must preserve that route and identical Markdown serializer.
- Keep helper logic pure so Plan 009's Node test harness need not emulate a full WebView.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Focused tests | `pnpm --filter @opnshelf/mobile test -- safe-links.test.ts MilkdownWebView.test.tsx` | all pass |
| Typecheck | `pnpm --filter @opnshelf/mobile typecheck` | exit 0 |
| Check | `pnpm --filter @opnshelf/mobile check` | exit 0 |

## Scope

**In scope**:
- `apps/mobile/src/lib/safe-links.ts` and `.test.ts` (create)
- `apps/mobile/src/components/ui/Markdown.tsx`
- `apps/mobile/src/components/detail/MilkdownWebView.tsx`
- `apps/mobile/src/components/detail/MilkdownWebView.test.tsx` (create only for component wiring; pure trust tests belong in `safe-links.test.ts`)

**Out of scope**:
- Supporting `mailto:`, `tel:`, deep links, downloads, popup windows, auth WebBrowser flows, web editor implementation, CSP/server headers, or changing Markdown syntax.

## Git workflow

- Branch: `codex/improve-013-mobile-link-webview-boundary`
- Commit message: `Restrict mobile review link navigation`
- Do not push/open a PR unless instructed.

## Steps

### Step 1: Add pure URL policies

Create small helpers that parse with `URL` inside try/catch. Public Markdown external links are allowed only for exact `http:` and `https:` protocols. Editor trust is stricter: derive the normalized origin from `env.siteUrl`, allow only that origin and exact `/embed/review-editor` pathname (query/hash may vary for the theme), and reject credentials, protocol-relative ambiguity, malformed URLs, sibling paths, subdomains, and lookalike hostnames. Return booleans; never throw on user content.

**Verify**: table tests cover http/https, upper/lower-case normalization, javascript/data/file/custom schemes, malformed strings, trusted route/theme query, different origin, lookalike hostname, sibling route, and embedded credentials.

### Step 2: Gate Markdown link opening

Before calling `Linking.openURL`, require the external-web policy. For an allowed URL, optionally check `Linking.canOpenURL` if the existing platform convention requires it, then handle rejection without crashing. Disallowed URLs perform no OS action. Do not display or log the URL.

**Verify**: tests or isolated handler assertions show HTTPS opens and each prohibited scheme does not invoke Linking.

### Step 3: Bind WebView navigation and bridge messages

Replace wildcard `originWhitelist` with the configured trusted web origin. Add `onShouldStartLoadWithRequest` using the exact editor-route policy; account for the initial platform `about:blank` only if tests/runtime prove it necessary, and never accept another network origin. In `handleMessage`, reject messages unless `event.nativeEvent.url` passes the same trusted editor policy. Keep JSON shape/type checks and the existing safe `JSON.stringify` injection. Disable or deny new-window/external navigation rather than opening it implicitly.

**Verify**: wiring tests capture WebView props and prove trusted route loads/messages work, while foreign origin, sibling route, malformed payload, and spoofed lookalike are rejected.

## Test plan

- Prefer comprehensive pure table tests plus a narrow mocked-WebView wiring test.
- Assert `onChange` and `injectJavaScript` only run for messages from the exact trusted page.
- Test theme query changes remain allowed.
- Run the full mobile suite/typecheck/check.

## Done criteria

- [ ] `rg 'originWhitelist=\{\["\*"\]\}' apps/mobile/src` returns no matches.
- [ ] Markdown opens only HTTP(S).
- [ ] WebView network navigation and bridge messages are restricted to the configured origin plus exact editor route.
- [ ] Trusted editor ready/change behavior still passes tests.
- [ ] All mobile gates pass and only Scope files changed.

## STOP conditions

- `env.siteUrl` can legitimately contain a path prefix that makes exact editor-route derivation ambiguous.
- The WebView emits no sender URL on a supported platform and origin validation cannot be enforced without a different bridge protocol.
- The editor requires redirects across origins in deployed configuration.
- Supporting a non-HTTP(S) public link is a product requirement.

## Maintenance notes

If the editor route or site origin changes, update the centralized policy and its lookalike tests together. Reviewers should scrutinize any future wildcard, suffix hostname comparison, or message handler that trusts only payload shape.

