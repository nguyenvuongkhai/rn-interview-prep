## Task
Write `decideUpdate(installed, latest, minSupported)`. It returns:

- `'force'` when `installed` is older than `minSupported`
- `'soft'` when it is not forced but is older than `latest`
- `'none'` otherwise, including when `installed` is newer than `latest`

Versions are semver strings: `MAJOR.MINOR.PATCH`, with an optional prerelease after `-`, such as `4.0.0-beta.2`.

## Why interviewers ask
A backend drops an old API, and every version below 2.10.0 must update. Comparing `'2.9.5' < '2.10.0'` as strings gives `false`, so the users who most need the update never see the prompt. The usual follow-ups: why must a network error never force an update, and why wait for a staged rollout to reach 100% before raising `minSupported`?

## Example
```ts
decideUpdate('2.9.5', '2.11.0', '2.10.0'); // 'force'
decideUpdate('2.10.3', '2.11.0', '2.10.0'); // 'soft'
decideUpdate('2.11.0', '2.11.0', '2.10.0'); // 'none'
```

## Rules
- Compare `MAJOR`, `MINOR` and `PATCH` as numbers, not as strings.
- A missing patch counts as 0: `'3.1'` equals `'3.1.0'`.
- A prerelease is lower than its release: `'4.0.0-rc.1'` is lower than `'4.0.0'`.
- Split a prerelease on `.` and compare the identifiers left to right: numeric ones as numbers, others as strings, and a numeric identifier is lower than a non-numeric one. If one list runs out first, it is the lower one: `'1.0.0-alpha'` is lower than `'1.0.0-alpha.1'`.
- Inputs are well formed, so you do not need to validate them.
