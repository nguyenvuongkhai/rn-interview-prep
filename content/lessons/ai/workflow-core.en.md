---
id: ai-workflow-core
topic: ai/workflow
kind: core
readMinutes: 5
---
## TL;DR
An AI assistant speeds up reading, drafting and repetitive edits, but it does not know your codebase, your installed versions or your product rules unless you give them to it. Its output is a draft. Whoever commits the code owns it: you read the diff, run the tests, and check every unfamiliar API against the docs for the RN version you actually ship.

## Under the hood
### Where it helps in RN work
- Reading unfamiliar code: ask it to explain a native module or a saga flow, then confirm by reading the code it points to.
- Debugging: give it a symbolicated stack, versions and what changed, and use its answer as a list of hypotheses to reproduce, not as a conclusion.
- Tests: ask for the list of cases first, then the tests. Check expected values against requirements and break the code on purpose to see a test fail.
- Migrations and upgrades: hand-convert one example, then let it apply the pattern in small, reviewable batches. Feed it the changelog and the Upgrade Helper diff.
- Review and docs: a second pass for missed edge cases, or a first draft of a PR description you then correct.

### Why it gets things wrong
A model predicts plausible code from patterns it learned. It does not run your compiler or read `node_modules` unless those files are in its context, so it can invent a prop, mix one library's API into another (`estimatedItemSize` on `FlatList`), or reach for an API that left core long ago (`AsyncStorage` from `react-native`). Its training data has a cutoff, and older RN code dominates it, so for a recent release it guesses. It sounds equally confident when it is wrong.

### How to verify
- Read the whole diff as you would a colleague's PR.
- Let TypeScript and the type definitions in `node_modules` settle whether an API exists. RN silently ignores unknown props at runtime.
- Run the tests and lint, then try the affected screens on both platforms, on a release build when the bug was release-only.
- Check behaviour that depends on a version against the docs for the version in your `package.json`.

### Data, secrets and licences
Anything you paste into an external tool leaves your control. Strip tokens, keys and personal data from logs, and follow company policy on which tools may see which code. A secret in the app is never safe: `EXPO_PUBLIC_` variables and other build-time env values are inlined into the bundle. Generated code can also closely match licensed code, so treat a large, oddly specific snippet like code copied from the internet and check where it came from.

### When not to use it
Skip it when policy forbids sending that code out, when you cannot judge whether the answer is right, or when a codemod or a two-minute edit is more reliable.

## Interview angle
- "Tell me about a time you used AI to..." Give the context, what you gave it, how you verified the output, one mistake you caught, and the result.
- Be honest about which part the AI did and which part you did. Interviewers look for judgement.

## Common pitfalls
- Accepting a prop or API because the app ran without errors
- Tests that copy current output into `expect` and lock bugs in
- Trusting its summary of a changelog without reading the changelog
- Pasting logs with tokens or user data into an external tool
- Saying "the AI wrote it" in review or in an interview

## Related
`ai/prompting`, `maintain-upgrade-core`, `maintain-crash-core`, `performance-lists-core`
