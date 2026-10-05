---
id: workflow-git-agile-core
topic: workflow/git-agile
kind: core
readMinutes: 6
---
## TL;DR
A mobile team cannot redeploy the way a web team can: every binary goes through store review, and several versions stay live at once. That is why mobile teams keep release branches and tags even when they work trunk-based. A hotfix starts from the release tag, and the job is not finished until the fix is also on `main`. In Agile terms, store review and real-device QA belong in the plan and in the definition of done.

## Under the hood
### Branching models
- Git Flow keeps a long-lived `develop`, plus `release/*` and `hotfix/*` branches. It is predictable, but long feature branches end in painful merges.
- Trunk-based development merges short-lived branches into `main` daily, behind required CI and review. Unfinished work hides behind feature flags, so merging and releasing are separate decisions.
- Mobile usually mixes the two: trunk-based day to day, plus a `release/3.5` branch cut from `main` on a release train schedule. Pick one rule for fixes, such as fix on `main` first and cherry-pick to the release branch.

### Hotfix flow
Start from exactly what is in production: `git switch -c hotfix/3.4.1 v3.4.0`. Keep the fix minimal, bump the version and the store build number, tag `v3.4.1` and build from the tag. Then bring the fix back to `main` with a merge or a cherry-pick of the fix commit itself. A tag points at one commit, usually the version bump, so `git cherry-pick v3.4.1` misses the fix. Decide OTA or binary first: a JS-only fix on the same runtime version can ship over the air; anything native needs a new build.

### Rewriting history
Rebase, amend and reset all create new hashes. That is fine on your own branch, followed by `git push --force-with-lease`, which refuses when the remote has commits you have not fetched. On a shared branch, use `git revert <sha>` instead.

### Finding and fixing regressions
`git bisect` halves the range at each step, so 400 commits take about 9 tests. Mark a commit you cannot build with `git bisect skip`, never good or bad.

### Lockfiles and ignored files
Lockfiles are generated output. On conflict, merge `package.json` by hand, take one side's lockfile, rerun `npm install`, then `pod install`, and commit both. In `.gitignore` the last matching rule wins, so a later `!` line can re-include a keystore; `git check-ignore -v <path>` shows the deciding line. A secret that reached history is leaked: rotate it.

### Agile on mobile
Conventional Commits drive semver: `fix` is a patch, `feat` a minor, `!` or `BREAKING CHANGE:` a major. A done story is tested on real devices on both platforms, measured, and flagged. Plan backwards from the submit date, because review time varies and a rejection costs a round. A production incident mid-sprint is unplanned work: tell the PO and drop an equal amount of scope.

## Interview angle
- "Production crashes and `main` has unreleased work. Walk me through the hotfix." Tag, branch, minimal fix, version bump, staged rollout, back to `main`, post-mortem.
- "Why not deploy straight from trunk?" Store review and several live versions; you must patch an old version while `main` moves on.

## Common pitfalls
- Branching a hotfix from `main`
- Cherry-picking the release tag instead of the fix commit
- Rebasing or force-pushing a shared branch
- Hand-merging `package-lock.json`
- A `.gitignore` negation that re-includes a keystore or `.env`
- A CI `if:` on `github.ref` that skips required checks on every PR
- Treating "submitted to review" as done

## Related
`release-ota-ci-core`, `maintain-regression-core`, `release/android`, `release/ios`
