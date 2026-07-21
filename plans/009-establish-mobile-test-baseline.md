# Plan 009: Establish a focused mobile Vitest test baseline and CI gate

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report; do not improvise. When done, update this plan's row in `plans/README.md` unless the reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat e6b9e04..HEAD -- apps/mobile/package.json apps/mobile/tsconfig.json apps/mobile/vitest.config.ts apps/mobile/src/test apps/mobile/src/lib/use-debounce.test.tsx pnpm-lock.yaml .github/workflows/ci.yml`
> If an in-scope file changed, compare the current-state excerpts below with live code. A material mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `e6b9e04`, 2026-07-20

## Why this matters

The mobile app has auth, secure-storage, WebView, and pagination logic but no test command or CI test gate. Plans 010, 013, and 015 need deterministic regression tests; without a baseline, those security and correctness changes would depend on manual device testing. This plan establishes only a small Vitest/React Native hook-oriented harness, not broad UI coverage.

## Current state

- **Verified baseline exception (2026-07-20):** the clean planned commit's
  mobile Biome check reports only pre-existing formatting/class-order issues in
  `MediaCard.tsx` and formatting plus the existing non-null assertion warning
  in `ShelfTab.tsx`. Both files are out of scope here and have uncommitted fixes
  in the user's working tree. The executor may proceed only while diagnostics
  remain limited to those files and may not edit or commit either file.

- `apps/mobile/package.json` has `check` and `typecheck`, but no `test` script and no test dependencies:

```json
"scripts": {
  "check": "biome check .",
  "typecheck": "tsc --noEmit"
}
```

- `.github/workflows/ci.yml:107-131` runs install, check, and typecheck for mobile, but no tests.
- `apps/mobile/src/lib/use-debounce.ts:8-17` is a low-risk first hook to prove rendering, rerendering, fake timers, and cleanup:

```ts
export function useDebounce<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const handle = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(handle);
	}, [value, delayMs]);
	return debounced;
}
```

- The web workspace already uses Vitest with a dedicated `vitest.config.ts`; follow that separation rather than loading an application bundler config.
- Repo formatting is Biome with tabs in TypeScript. Package changes use pnpm and must update the root lockfile.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install/update lockfile | `pnpm install` | exit 0 and lockfile consistent |
| Mobile tests | `pnpm --filter @opnshelf/mobile test` | exit 0, baseline tests pass |
| Mobile typecheck | `pnpm --filter @opnshelf/mobile typecheck` | exit 0, no errors |
| Mobile check | `pnpm --filter @opnshelf/mobile check` | exit 0, or only the exact verified baseline exception above |

## Scope

**In scope** (only these files):
- `apps/mobile/package.json`
- `apps/mobile/tsconfig.json` only if test globals/types require it
- `apps/mobile/vitest.config.ts` (create)
- `apps/mobile/src/test/setup.ts` (create only if a shared setup is actually required)
- `apps/mobile/src/test/render-hook.tsx` (create)
- `apps/mobile/src/lib/use-debounce.test.tsx` (create)
- `pnpm-lock.yaml`
- `.github/workflows/ci.yml`

**Out of scope**:
- Production mobile source, native `ios/` and `android/` projects, snapshots, E2E/device tests, and web/backend test configuration.
- Adding Jest, `jest-expo`, or a DOM browser environment. The baseline should run in Node and use React's test renderer for hooks.

## Git workflow

- Branch: `codex/improve-009-mobile-test-baseline`
- Use the repository's concise imperative commit style, for example: `Establish mobile test baseline`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add the smallest compatible test toolchain

Add a `test` script using `vitest run`. Add compatible development dependencies for Vitest, `react-test-renderer` matching React `19.2.3`, and its types. Prefer exact compatibility with the installed React/Expo versions; do not upgrade React, React Native, Expo, TypeScript, or unrelated packages. Create a dedicated config with Node environment, test globals (or explicit imports consistently), path alias support for `@/*`, and a setup file only if required.

**Verify**: `pnpm --filter @opnshelf/mobile exec vitest --version` → exit 0 and prints a version; `pnpm install --frozen-lockfile` → exit 0 after the lockfile update.

### Step 2: Add a reusable hook renderer and characterization test

Create a small `renderHook` helper using `react-test-renderer` and `act`, exposing the latest result plus `rerender` and `unmount`. Test `useDebounce` for: initial value is immediate; a changed value stays old before the delay; the value updates after fake timers advance; rerender cancels the previous timer; unmount leaves no pending update. Restore real timers after each test.

**Verify**: `pnpm --filter @opnshelf/mobile test -- use-debounce.test.tsx` → all new tests pass with no unhandled act warnings.

### Step 3: Make mobile tests a CI gate

Add a `Test` step to the existing `mobile` CI job after typecheck. Run the package script, matching the filter syntax already used by the job. Do not create a separate job or alter path filters in this plan.

**Verify**: `rg -n -A2 'name: Test' .github/workflows/ci.yml` → shows `pnpm --filter mobile run test` (or the equivalent package-name filter) inside the mobile job.

## Test plan

- `apps/mobile/src/lib/use-debounce.test.tsx`: at least four assertions spanning initial state, delayed update, cancellation/rerender, and unmount.
- Use fake timers deterministically; never sleep in tests.
- Full verification: `pnpm --filter @opnshelf/mobile test && pnpm --filter @opnshelf/mobile typecheck && pnpm --filter @opnshelf/mobile check` → all exit 0.

## Done criteria

- [ ] `pnpm --filter @opnshelf/mobile test` exits 0 and runs the new tests.
- [ ] Mobile typecheck exits 0; check either exits 0 or reports only the exact
  verified baseline exception above.
- [ ] `.github/workflows/ci.yml` runs mobile tests.
- [ ] `pnpm install --frozen-lockfile` exits 0.
- [ ] No production source or files outside Scope changed.

## STOP conditions

- Vitest cannot load a hook without transpiling/modifying production React Native source.
- The chosen renderer requires changing the app's React, React Native, or Expo versions.
- Tests emit persistent act/runtime warnings after one reasonable configuration correction.
- Mobile check reports any diagnostic beyond the exact verified baseline
  exception above.
- An in-scope file materially differs from Current state or verification fails twice.

## Maintenance notes

Keep this harness focused on pure functions, hooks, and components with narrow native mocks. Device behavior belongs in a future E2E plan. Review lockfile changes for unrelated upgrades.
