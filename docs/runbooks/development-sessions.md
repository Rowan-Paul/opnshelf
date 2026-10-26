# Development sessions and verification scenarios

Use Node 24 and the repository's pnpm version. Before using a server or device,
run `pnpm dev:status`: it reports owner, worktree, ports and runner liveness.
Codex sessions use `CODEX_THREAD_ID` automatically. Other runtimes should set
`OPNSHELF_DEV_OWNER` to their thread ID; outside an agent it defaults to the
worktree path. Device claims are explicit:

```sh
pnpm dev:device:claim DEVICE_ID
pnpm dev:doctor DEVICE_ID
# After building and installing this checkout's native development client:
pnpm dev:device:record DEVICE_ID
# When device verification is finished:
pnpm dev:device:release DEVICE_ID
```

Claims prevent cooperating sessions from sharing a device accidentally. They do
not replace T3's own device ownership: use `device_list`, `device_open` and the
returned agent-device executable/config/session. Preserve a human-controlled
session. Claims survive crashes. After inspecting ownership, use
`node scripts/dev-session.mjs release-stale-stack ui-scenarios` (or `spaces-local`)
to release your own dead runner. It refuses live runners and recorded live
children. Device claims are released explicitly with `dev:device:release`. Native fingerprints include configuration,
resolved dependencies, modules and plugins; an unknown or changed fingerprint
requires rebuilding/installing before calling native verification complete.
Managed scenario/Spaces runners record the route filenames and generated type
hash after Metro is ready. `dev:doctor` rejects a changed or missing snapshot.
After using an unmanaged Metro, regenerate types and run
`node scripts/dev-session.mjs record-routes` in that worktree.

### iOS ExpoModulesJSI cache after changing Xcode

With Expo SDK 57, an iOS build can fail in `ExpoModulesJSI.swiftinterface` with
`cannot find type '__ObjC::expo' in scope` after an Xcode/Apple SDK change. The
installed JSI build script hashes the Swift compiler version but not the Xcode
build or SDK. Two Xcode versions can share that compiler version and incorrectly
reuse a binary module. See [Expo's matching report](https://github.com/expo/expo/issues/50365).

If this exact failure occurs, invalidate only the generated simulator slice's
stamp, then rebuild with the currently selected Xcode. From the repository root:

```sh
node <<'JS'
const { createRequire } = require('node:module');
const { dirname, join } = require('node:path');
const { rmSync } = require('node:fs');
const expo = createRequire(require.resolve('expo/package.json', { paths: ['./apps/mobile'] }));
const core = createRequire(expo.resolve('expo-modules-core/package.json'));
const jsi = dirname(core.resolve('expo-modules-jsi/package.json'));
rmSync(join(jsi, 'apple/Products/ExpoModulesJSI.xcframework/ios-arm64_x86_64-simulator/.build-hash'), { force: true });
JS
```

Use the normal local iOS build command afterwards. This preserves application
data and installed dependency versions; it does not require disabling precompiled
Expo modules. Repeat the invalidation if switching back to an older Xcode causes
the same failure. A successful build still needs launch and feature verification
on the target simulator.


## Real local PDS

For privacy and real OAuth checks use [the isolated Spaces stack](spaces-local-trial.md).
Its runner exclusively claims the stack during setup/start, records application
PIDs and log paths in `session.json` under its state directory, and refuses to
stop a stack owned by another worktree/thread. `node scripts/local-spaces.mjs status`
shows the last session, including whether it was stopped. A separate
`OPNSHELF_SPACES_STATE_DIR` changes data/log storage, not fixed ports or Docker
ownership. A second stack still needs to wait for the first owner.

## Repeatable client scenarios

Run these against the fixture API only, without resetting a personal account:

```sh
pnpm dev:scenarios web normal
pnpm dev:scenarios mobile sheet-overlap
pnpm dev:scenarios both failed-settings
```

Only one fixture runner can own the fixed ports. Web is at
`http://127.0.0.1:3390/onboarding`, fixture API/controller at
`http://127.0.0.1:3391/__scenario`, and Metro at 8084. The controller resets the
scenario; reload the client to clear cached state. Scenarios include normal,
failed-settings (503), delayed-auth (4.5-second return), sheet-overlap (ungranted
Privacy), migration-running (3/10 records), conflict (409), compact, large-text
and trakt-sync-catch-up (Trakt Sync Banner at 40%).
Open `/settings/privacy` to exercise scope dialogs, individual Lists and progress.

The `issue-fixes` scenario starts with Onboarding complete, a configured Trakt
connection with all record types selected, six Up Next shows and two picker
choices. Use `/trakt-sync`, `/profile/synthetic.test/up-next` and `/pick-for-me`
to verify the chooser and responsive layouts. Picker budgets below 45 minutes
return no choices. Its synthetic titles use one public TMDB image for cache
checks; only those image reads leave the local fixture stack.

Web uses the synthetic account directly. On Mobile, connect the development
client to this Metro first, then open the controller's `opnshelf://auth/complete?session=fixture-only`
link. This development token works only on the local fixture. Never use that
link with a real API. OAuth screens are simulated here: they check native
presentation and navigation, not authorization security. Use the reference
runner and real local stack for protocol/consent verification.

For Android use `adb reverse tcp:3391 tcp:3391` and
`adb reverse tcp:8084 tcp:8084`, then connect the development client to
`http://127.0.0.1:8084`. For compact screens use the Pixel emulator's small-screen
configuration; for large text raise the device's accessibility text size. Restore
these settings after testing. Verify the reported platform and original trigger:
an iOS screenshot does not close an Android-specific regression.

The fixture binds loopback, rejects unexpected browser origins and never proxies
requests to another server. Unknown routes fail with an explicit 404. Data is
in memory. Ctrl-C stops only the runner's child processes. After stopping Metro,
reconnect a retained device to its usual server before handing it back.

The `watch-completion` scenario starts Show 1399 with Episode 1 of its two-episode
Season already watched. Open `/shows/1399/local-fixture-show/seasons/1` and log
Episode 2 or mark the remaining Season watched to check completion confetti.
Reset the scenario before repeating; rewatches must not replay the celebration.

## Authenticated Lighthouse

`pnpm test:lighthouse` builds the production Web App, starts Nitro on loopback
port 3390 and a synthetic API on 3391, and audits Home, Shelf, Up Next, populated
Search and a Show page three times each with mobile browser emulation. Install
the pinned browser first with `pnpm exec puppeteer browsers install chrome`.
On Debian/Ubuntu, `--install-deps` also installs system libraries and requires
root. `LHCI_RUNS=1 pnpm test:lighthouse` is a shorter local smoke check.

The browser uses sibling `web.opnshelf.localhost` and `api.opnshelf.localhost`
hostnames, which Chrome resolves to loopback. The API session cookie is host-only
on the API hostname; the Web hostname gets only the signed-in hint from ADR 0039.
The session is synthetic and accepted only by the fixture. No real OAuth, account,
PDS or database is involved. Data comes from explicit fixture responses and shared
scenario account responses; unexpected requests and writes fail. Public TMDB
image reads still leave this stack. Analytics is disabled for this build.

A custom Lighthouse audit checks the actual measured page's route, profile link
and populated content on every run. Report validation also requires a successful
browser session check and the expected API reads. Those validity checks fail the
local command; performance, accessibility, best-practices and SEO scores report only.
This measures production frontend code with synthetic API latency, not deployed
backend performance, OAuth correctness or native Mobile App performance.

Reports stay in `.lighthouseci/` locally. Lighthouse does not run in GitHub Actions
and has no hosted Railway dashboard. The runner owns a `stack:lighthouse`
development lease and stops its own processes on completion or interruption.
Do not run the UI scenario stack concurrently: it uses the same ports.
