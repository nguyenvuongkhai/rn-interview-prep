---
id: ai-prompting-core
topic: ai/prompting
kind: core
readMinutes: 6
---
## TL;DR
An AI assistant knows only what you give it and what it guesses. A good coding prompt gives the facts (versions, the relevant files, the exact error, the constraints), states the expected result and a definition of done you can check, and keeps the task small enough to review. When the output is wrong, go back with the specific failure instead of accepting it or starting over. Checking the result stays your job.

## Under the hood
### Context the assistant cannot guess
- Versions. Behaviour and APIs change between releases: RN 0.76 and 0.77 still ship React 18.3, so a fix built on `useEffectEvent` (React 19.2) will not work there. Write "RN 0.77, React 18.3", never "latest".
- The relevant files, chosen by you. A whole repo buries what matters.
- The exact error, the symbolicated stack and timestamped logs. Evidence from the wrong build, such as a debug warning for a release-only crash, sends the assistant the wrong way.
- Constraints: "no new dependencies", "keep the public API of `useCart`", "do not turn off Hermes".
- Never secrets. Replace real keys and tokens with fake values in the same format.

### Expected result and definition of done
"Make it clean" cannot be checked. "Done when the existing tests pass, a new test covers `qty` 0 and exports stay the same" can. The assistant uses it to know when to stop; you use it to judge the result.

### Small steps
For big work, ask for a plan first and review it. Do one screen or module, review it, then use it as the example for the rest. End each step green with a diff small enough to read. Keep cleanup out of a bug fix.

### Tests, explanations and examples
Ask for a test that fails before the fix and passes after, and for an explanation of the cause before the code. It exposes wrong reasoning early. To get your team's style, paste a real file as the example instead of describing the style.

### Iterate with the failure
When a fix fails, paste the failing test, its output and the input that breaks it, and ask why the previous fix allowed it. "Try again" and a fresh session both throw away the one fact you just learned.

### Review and debug prompts
- Review: give the diff plus the files it depends on, the intent, the risks to probe, and ask for findings by severity with a line and a failure scenario. Verify every finding; some will be wrong.
- Debug: ask for ranked hypotheses and how to confirm each before any code.

### When information is missing
If you know a decision is still open, say so and ask the assistant to ask questions or list its assumptions before writing code.

```text
Before:
The cart adds items twice sometimes, fix it.

After:
RN 0.79, React 19, Redux Toolkit 2. File: CartButton.tsx (below).
Bug: two fast taps on "Add" add the item twice.
Constraints: no new dependencies, keep the props of CartButton.
Done when: a test with two fast presses sees one request,
and the existing cart tests pass. Explain the cause first.
```

## Interview angle
- "Tell me about a time you used AI to debug something." Give the context, the prompt, how you verified the answer and the result.
- "The answer was wrong. What did you do?" Show you iterated with the specific failure and knew when to stop and read the docs.

## Common pitfalls
- Writing "latest" instead of the real versions
- Pasting the whole repo, or real secrets
- Vague goals such as "clean" or "best practice"
- Asking to rewrite everything as part of a bug fix
- Saying "try again" without the failing case
- Skipping a failing test to make the result look green
- Letting the assistant silently decide an open product question

## Related
`ai/workflow`, `maintain-crash-core`, `testing/unit`, `debug/js`
