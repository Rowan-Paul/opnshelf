# Publication, review and cleanup

Read this before publishing, monitoring, or merging a pull request. Authorization
requirements in the root guide apply throughout.

- When the operator requests publication, push the issue branch and open a ready pull request into `develop`. The pull request explains the problem and solution, links its issue, and includes before/after images for visual UI changes or a short recording for motion and timing changes. End the body with the model and harness that performed the work.
- When asked to babysit a pull request, watch checks and comments newer than the latest push using the runtime watcher below. Verify automated findings against the source, fix confirmed problems, and explain dismissed false positives. Continue until required checks are terminal and report the pull request URL and final state.
- Squash-merge only when the operator requests it. Merge authorization includes the post-merge cleanup below unless the operator asks to retain something.
- Move releases from `develop` to `main` through a separate pull request. Never open an issue-branch pull request into `main`.

### Post-merge cleanup

After confirming the pull request is merged, finish these steps before handoff:

1. Close linked issues fully resolved by the merged change, even if GitHub did not auto-close them because the target was `develop`. Keep partially resolved or broader tracking issues open and update their remaining work with the merged PR link.
2. Stop development servers, Metro instances, fixture servers, and other temporary processes started for this task. Preserve anything another active task uses or the operator asked to keep running.
3. Inspect the task's worktrees for modified, staged, and untracked files and commits beyond the merged PR head. Remove only completed task worktrees with no remaining work, then delete their local and remote issue branches. Preserve unrelated worktrees and branches; never force-remove a dirty worktree or discard unpublished work to complete cleanup.
4. Fetch the latest remote refs and prune stale tracking refs. Fast-forward the local `develop` checkout to `origin/develop` when it is clean and not in use by another task. Preserve a dirty, divergent, or busy checkout and report why its update was deferred.
5. Report the merged PRs, issue closures or remaining work, cleanup performed, and anything deliberately retained or blocked. A merged PR alone is not a completed handoff.

## Review completion

Record the requested reviewer and the commit reviewed before publication.
If the operator requests review before opening a PR, complete it first. A skipped
CodeRabbit review is not approval. When review is requested, trigger it only when
authorized; otherwise report it as pending. Do not request a bot review merely
because CI is green.

For a GitHub reviewer, run `pnpm review:status PR_URL REVIEWER_LOGIN`. It requires
an APPROVED review on the current head; absent, skipped, stale, dismissed and
changes-requested reviews fail. It reads state only and does not trigger reviews.
For an app-owned reviewer, retain its task ID, reviewed SHA and terminal report.

For T3 PR monitoring, use `watch_pull_request` when available and yield until
notified; end monitoring with `unwatch_pull_request` when handing back the PR.
Use bounded polling only when the runtime lacks a watcher. Report status changes,
not repeated unchanged queue states.

Review cross-client behavior, loading/error/cancellation states, delayed callbacks,
and native sheet dismissal against the accepted ADRs. These are judgment calls.
Mechanical rules belong in the repository's automated checks. Verify findings
against the source and carry unresolved findings into each subsequent review.
