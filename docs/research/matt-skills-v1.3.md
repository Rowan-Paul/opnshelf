# Matt Pocock skills v1.3 audit

Checked 5 October 2026 against release tags, the repository's tracked skills, the global installation, and 25 recent T3 conversations.

## Outcome

- Renamed the root glossary to `GLOSSARY.md`, preserving its contents byte for byte, and updated documentation and source-comment pointers.
- Updated the existing setup output in `AGENTS.md` and `docs/agents/domain.md`. GitHub tracking, triage labels, and the single-context layout remain valid.
- Compared installed skills without upgrading or removing them. The local `grill-with-docs` copy differs from upstream; the global installation has 25 matching skills, 11 changed skills, one missing skill, and one retired Matt skill still installed.
- The largest workflow opportunity is a deliberate retrospective after review, followed by a clearer specification-to-implementation handoff for larger features.

## Release baseline

[v1.3.0](https://github.com/mattpocock/skills/releases/tag/v1.3.0) shipped on 4 October 2026 at 12:47 UTC; [v1.3.1](https://github.com/mattpocock/skills/releases/tag/v1.3.1) followed at 12:48 UTC. This audit uses v1.3.1, commit `24fe0ef7737efae15c87225755e9f6f5965e4888`, rather than moving `main`.

The release promotes `implement-spec`, `pr`, and `retro` into Engineering, removes `resolving-merge-conflicts`, and changes the domain-doc convention to `GLOSSARY.md` / `GLOSSARY-MAP.md`. It also fixes cross-skill invocation and YAML discovery problems. Many of those fixes are already present in this machine's installation. The v1.3.1 patch corrects stale `ask-matt` advice: after debugging, the user invokes `retro`; debugging no longer automatically hands off to architecture improvement. See the [tagged changelog](https://github.com/mattpocock/skills/blob/v1.3.1/CHANGELOG.md).

## Repository versus global installation

`skills-lock.json` identifies just one repository-local Matt skill: `.agents/skills/grill-with-docs`. The other repository skills come from Expo and Anthropic and are outside this upstream comparison. The Matt skills used by most sessions live under the global `.agents/skills` directory.

The repository-local skill has this entire content difference; its `agents/openai.yaml` matches:

```diff
-Run a `/grilling` session, using the `/domain-modeling` skill.
+Call the Skill tool twice, for "grilling" and "domain-modeling".
```

The global `grill-with-docs` already has the newer instruction. Actual sessions loaded different copies: PDS Styling loaded the global skill, while Watch-date editing loaded the repository skill. Synchronizing the local copy is worthwhile even though both runs did reach grilling and domain modeling. In Codex, loading the named `SKILL.md` files is the available equivalent of Claude's Skill tool.

The [complete skill diff](matt-skills-v1.3.diff) compares the repository and global copies with v1.3.1. It includes supporting files and Codex metadata, not just `SKILL.md`. Direction is installed → release. Nothing in that patch was applied to the global installation.

| Global skill | Difference from v1.3.1 |
| --- | --- |
| `ask-matt` | Adds implementation alternatives, PR-body and retrospective steps; updates glossary paths and debugging guidance; drops retired conflict skill routing. |
| `codebase-design` | `DESIGN-IT-TWICE.md` changes its glossary pointer. |
| `diagnosing-bugs` | Glossary filename only; the newer cleanup and invocation behavior is already installed. |
| `domain-modeling` | New glossary and map filenames; `CONTEXT-FORMAT.md` becomes `GLOSSARY-FORMAT.md`. |
| `implement-spec` | Integration branch becomes the goal; tracker precondition, conditional later PR creation, worktree base checks, TDD, integration-tip merges, and explicit review invocation; Codex description also changes. |
| `improve-codebase-architecture` | Glossary filename changes. |
| `retro` | Inspects existing checks first; mechanical mistakes become deterministic checks, while review standards retain judgment calls. |
| `setup-matt-pocock-skills` | Glossary and map filenames in the skill and `domain.md` template. |
| `tdd` | Glossary filename only. |
| `triage` | Glossary filename only. |
| `wait-what` | Glossary and map filenames only. |
| `pr` | Missing locally; upstream provides `SKILL.md`, `CREDITS.md`, and Codex metadata. |
| `resolving-merge-conflicts` | Installed locally, removed upstream without a replacement. |

All files match for these 25 skills: `code-review`, `grill-with-docs`, `implement`, `prototype`, `research`, `to-spec`, `to-tickets`, `wayfinder`, `wizard`, `claude-handoff`, `loop-me`, `setup-ts-deep-modules`, `writing-beats`, `writing-fragments`, `writing-shape`, `git-guardrails-claude-code`, `migrate-to-shoehorn`, `scaffold-exercises`, `setup-pre-commit`, `grill-me`, `grilling`, `handoff`, `teach`, `to-questionnaire`, `writing-for-agents`.

This includes upstream's in-progress and miscellaneous buckets, not only plugin-shipped Engineering skills. `ponytail` is from `dietrichgebert/ponytail`, so its usage is not counted as Matt's.

## Setup check

Compared all files in the installed `setup-matt-pocock-skills` directory against [v1.3.1](https://github.com/mattpocock/skills/tree/v1.3.1/skills/engineering/setup-matt-pocock-skills). Only `SKILL.md` and `domain.md` differ, entirely through glossary naming. The GitHub/GitLab/local tracker templates, label template, and Codex metadata match.

Opnshelf already has the three setup outputs and their AGENTS pointers. This migration updates the domain pointers in place; it does not need the first-run setup questionnaire or a new multi-context map. Existing operator choices settle those questions. The global setup skill itself remains old until separately upgraded.

`docs/agents/domain.md` now explicitly tells older installed skills to use the repository's current glossary path. This bridges the rename without creating two sources of domain vocabulary.

The sampled PDS Styling conversation also contains a review warning that the separate Tranquil PDS repository lacks `docs/agents/issue-tracker.md`. Opnshelf's setup does not configure that fork; running setup there would remove that recurring discovery gap. No files in that repository were changed by this audit.

## Session method and limits

Used T3's project thread list and paginated activity reads. Selected the 25 most recently updated top-level conversations in the Opnshelf project before this audit. Excluded this conversation, child agents, and duplicate `import:codex:` mirrors of conversations already represented by their normal thread. This is a project-scoped sample, not the last 25 conversations across every project or coding application.

Counted explicit user requests separately from observed execution. Execution evidence is a skill-file read, an assistant statement that it is applying the skill, or a completed matching review workflow. Merely listing available skills, quoting AGENTS instructions, discussing a skill, or finding a `ponytail` code comment does not count. Counts are conversations containing a skill, not every invocation or tool call. Failed and interrupted review requests remain in the sample but do not count as executed reviews.

All selected timelines were paginated to their end, covering 4,044 activity items. Older migrated timelines often contain only messages, so absence means **not observed**, not proof the skill never ran. Tool bodies were read with a 12,000-character per-item cap; these results are an evidence-backed usage sample rather than exhaustive invocation telemetry. No raw session transcripts are copied into this report.

| Matt skill | Explicit requests, conversations | Observed use, conversations |
| --- | ---: | ---: |
| `grill-with-docs` | 6 | 6 |
| `grilling` | 0 | 6 |
| `domain-modeling` | 0 | 7 |
| `code-review` | 4 | 4 |
| `diagnosing-bugs` | 0 | 4 |
| `research` | 0 | 2 |
| `writing-for-agents` | 0 | 2 |
| `resolving-merge-conflicts` | 0 | 2 |

The four executed reviews comprise two explicit completed reviews and two agent-selected uses (Spaces and PDS Styling). The other two explicit requests failed or were interrupted. No use of `retro`, `implement-spec`, `implement`, `to-spec`, `to-tickets`, `tdd`, `wayfinder`, or `pr` was observed. This does not imply those underlying activities never happened: agents wrote tests, specs, and PRs without an observed invocation of those skills.

Outside Matt's set, `ponytail` was announced in five conversations. PR-evidence and the Expo, data-fetching, design, and Railway skills recur alongside Matt's design workflow.

## Recommendations based on this sample

1. **Keep `grill-with-docs` as your default feature entry point; synchronize both copies.** Six recent features already start this way. The release's explicit dependency-loading instruction addresses the exact local/global difference found here. Upgrade `domain-modeling` and the other glossary consumers together so future sessions consistently read `GLOSSARY.md`. The global `grilling` primitive already matches v1.3.1, including its question separators; this is not a new benefit for this installation.

2. **Add an explicit `retro` after expensive review or debugging sessions.** Spaces involved repeated Fable review rounds; the bug-report session led to a new post-merge cleanup rule. These are good inputs for a retrospective that proposes a reusable check or a small navigation improvement. Start with “Run retro on the Spaces session; propose the three highest-value prevention changes.” The newer skill first checks existing CI and hooks, which matters because Opnshelf already has both. Avoid turning every discovered mechanical mistake into another AGENTS paragraph. `retro` is user-invoked: ask for it directly.

3. **For larger features, freeze the agreed spec before building and reviewing.** The Featured Content and Release Notes reviews explicitly noted thin issue descriptions and treated PRDs added in the implementation PR as author elaboration. After grilling, use `to-spec` and, when work spans sessions, `to-tickets`; confirm that artifact before implementation, then pass its path or revision to reviewers. This workflow already exists in the installed skills; v1.3 makes the next parallel implementation step easier to discover.

4. **Pilot `implement-spec` on a genuinely separable task graph.** Your sessions currently tend to go from grilling into one long build, with later merge-conflict work. The promoted skill gives parallel implementers an explicit common integration base and dependency frontier. First adapt its workflow to Opnshelf: base branches on `develop`, preserve one concern per PR, use T3's workspace-bound launches when separate worktrees are needed, and preserve explicit authorization for publication and merges. Its draft-PR and automatic integration behavior is not a drop-in match for the current repository rules. For a small feature, keep the simpler single-session path.

5. **Adopt `pr` for evidence quality, alongside existing PR-evidence hosting.** The missing skill provides a compact change visualization, before/after evidence, and a rollback/blast-radius assessment. Your existing screenshot workflow already supplies much of the evidence. Use the template where useful, retaining Opnshelf's issue link, release route, verification results, and model/harness footer. It does not authorize opening a PR by itself, and it does not replace the screenshot uploader.

6. **Retire the dedicated conflict skill on the next installation update.** It was used in two sampled sessions, but upstream removed it. Keep Opnshelf's rules about explicit merge authorization and regeneration of generated clients; those remain useful regardless of skill availability.

The practical sequence is: `grill-with-docs` → confirmed spec → implementation → `code-review` → evidence-rich PR when authorized → `retro`. Add ticket decomposition and parallel implementation only when the feature needs them. `ask-matt` can remind you of these branches; it recommends user-invoked commands rather than running them automatically.

## Session sample

| # | Conversation | Last updated (UTC) | Explicit Matt request | Observed Matt skills / status |
| --- | --- | --- | --- | --- |
| 1 | Improve Feature Delivery Experience | 2026-10-05 | — | No Matt skill observed |
| 2 | Investigate atproto Spaces | 2026-10-05 | — | research; code-review |
| 3 | OpnShelf code-quality improvement | 2026-10-05 | — | No Matt skill observed |
| 4 | OpnShelf code-quality improvement | 2026-10-04 | — | No Matt skill observed |
| 5 | Update PDS Styling | 2026-10-04 | grill-with-docs | grill-with-docs; grilling; domain-modeling; code-review |
| 6 | Review Tranquil PDS Commit | 2026-10-04 | code-review | Requested code-review; provider failed |
| 7 | Grill AI Features Issue 187 | 2026-10-04 | grill-with-docs | grill-with-docs; grilling; domain-modeling |
| 8 | Explore Expo SDK 58 Features | 2026-10-03 | — | research |
| 9 | Changelogs on Leaflet | 2026-10-03 | grill-with-docs | grill-with-docs; grilling; domain-modeling; resolving-merge-conflicts |
| 10 | Grill Featured Content Proposal | 2026-10-03 | grill-with-docs | grill-with-docs; grilling; domain-modeling; writing-for-agents; resolving-merge-conflicts |
| 11 | Review Editorial Featured Content | 2026-10-03 | code-review | code-review |
| 12 | Review Editorial Featured Discover | 2026-10-03 | code-review | Requested code-review; interrupted |
| 13 | Review In-App Release Notes | 2026-10-03 | code-review | code-review |
| 14 | Blueray.com Integration Design | 2026-10-03 | grill-with-docs | grill-with-docs; grilling; domain-modeling |
| 15 | Allow Editing Logged Watch Dates | 2026-10-03 | grill-with-docs | grill-with-docs; grilling; domain-modeling |
| 16 | Draft Opnshelf Release Notes Post | 2026-10-03 | — | No Matt skill observed |
| 17 | Improve Codebase Quality | 2026-10-01 | — | No Matt skill observed |
| 18 | Make Notifications Useful Like the Digest | 2026-10-01 | — | domain-modeling |
| 19 | Investigate Feature Requests | 2026-10-01 | — | diagnosing-bugs |
| 20 | Investigate Open Bug Reports | 2026-10-01 | — | diagnosing-bugs; writing-for-agents |
| 21 | List Currently Open Issues | 2026-09-26 | — | No Matt skill observed |
| 22 | Prepare a New Release | 2026-09-26 | — | No Matt skill observed |
| 23 | Investigate Three PostHog Errors | 2026-09-26 | — | diagnosing-bugs |
| 24 | Test Notifications With Real Data | 2026-09-25 | — | diagnosing-bugs |
| 25 | Clean Up Branches and Worktrees | 2026-09-25 | — | No Matt skill observed |

### T3 thread identifiers

Identifiers correspond to the numbered rows above and make the sample reproducible within T3 without storing private conversation text.

1. `026ffc26-7f2d-4ecf-b9e1-82437d734421`
2. `ec2c0149-26e7-469d-9569-958b18fe64d2`
3. `thread:project:36c4b5f4-5243-41e0-843b-36e5327922b8:81a19f7b-4fb1-46dd-b2ac-b485293f1d0d`
4. `thread:project:36c4b5f4-5243-41e0-843b-36e5327922b8:58be891e-db16-4a42-8a71-da433c87e877`
5. `b650f58f-be34-452e-a5f9-5c93731bfda7`
6. `bbb20ac9-1adf-4d0b-a086-518f0534e8fc`
7. `384ada18-9fb7-4a7b-881c-c7cf172aefee`
8. `d371624c-ef41-425f-8efb-8a408cd11a08`
9. `f87a61d8-231d-42c9-87af-9bf3ade8379d`
10. `90106327-2003-461f-8264-8cc8732cdc2c`
11. `a47a5674-c157-4189-b12b-8de2450f7119`
12. `c348437a-746a-4390-91a8-e96469147a86`
13. `8c689460-8f7d-4051-ad7c-a8ab5be14e09`
14. `411091c8-5a8d-48d3-a337-a63a97fce09d`
15. `bf53bebd-90e5-4c85-af83-449e50308da4`
16. `ae07839f-e5d6-4589-bcdd-41cb416eaa43`
17. `18262df4-8968-46a2-a814-768b2f00dde3`
18. `2b55e947-0c01-426f-8559-e006094de0e8`
19. `2d9d566f-937a-4cfa-86fa-ffc2d2c2dca0`
20. `b3d4e91d-68f1-4e2b-9755-b84347264484`
21. `7e714fa8-2f03-425d-8ee6-a38e266bcbc2`
22. `e0e08efe-2cf8-4efa-a11b-77d01b001a9a`
23. `a7494cbc-9fca-46d5-acac-b97d09a0118a`
24. `3cf0aac4-831a-4abd-add0-a2de8cbabc1f`
25. `4a1f588e-45c7-45a5-ba35-b411e17ef084`

## Verification

The audit and migration were prepared on `chore/matt-skills-v1-3`, in the sibling `opnshelf-skills-v1.3` worktree, based on fetched `origin/develop` at `c38fbde003c94aad4fe00ee4675cb1a7f8098424`. The original checkout and its untracked research files were preserved. At the audit handoff, no skills had been installed, updated, or deleted, and no issue, PR, push, or deployment had been made. Publication was subsequently requested by the operator.

Changed files: root `CONTEXT.md` → `GLOSSARY.md`; `AGENTS.md`; root and docs READMEs; `docs/agents/domain.md`; glossary references in ADRs 0005, 0011, and 0017, the Social Hub PRD, issue-370 verification notes, and plan 018; five glossary references in Backend/Mobile source comments; this report and its full diff artifact. Source behavior is unchanged, and the plan's status is unchanged.

| Check actually run | Result |
| --- | --- |
| `pnpm install --offline --frozen-lockfile` | Passed using Node 24.19.0 and pnpm 11.1.2. |
| `pnpm prisma:generate` | Passed; no tracked generated changes. |
| `pnpm typecheck` | Passed across all three workspaces. |
| `pnpm check` | Passed across all three workspaces; no rewriting. |
| `pnpm --filter backend run build` | Passed; no tracked generated changes. |
| `pnpm --filter backend run test` | Passed on rerun: 109 files / 1,134 tests passed; one file / two tests skipped by the suite. |
| `pnpm --filter mobile run test` | Passed: 54 files / 363 tests passed; one file / one test skipped by the suite. |
| `git diff --check` | Passed for the migration. Staged checking excludes the raw `.diff` artifact, whose blank context lines intentionally contain the unified-diff space prefix. |
| Byte comparison against `HEAD:CONTEXT.md` | Exact match with `GLOSSARY.md`. |
| Tracked-file search for old glossary/map paths | No remaining references. Historical filenames in this audit and its diff are intentional. |
| Local/upstream `grill-with-docs` Codex metadata comparison | Exact match. |

The initial Backend test run failed to import a generated lexicon file while the concurrently running Backend build cleared and regenerated that directory. After the build completed, the complete Backend suite passed. Future verification should run that build and suite sequentially.

Web tests and API-client regeneration were not run: there are no Web or API-contract changes. No visual verification or Mobile release is needed for documentation/comment-only changes.
