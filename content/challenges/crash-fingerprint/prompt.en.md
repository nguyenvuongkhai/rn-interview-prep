## Task
Write `groupCrashes(reports, { ignorePrefixes, topN })`. Each report has an `id`, a `timestamp` and `frames`, the stack from the top (crash site) down. Group reports whose stacks have the same fingerprint and return one group per fingerprint: `{ fingerprint, count, firstSeen, lastSeen, reportIds }`.

Also export `normaliseFrame(frame)`, which turns one raw frame into its stable form.

## Why interviewers ask
The same bug looks different in every build: line and column numbers move, bundle URLs carry a new hash, native frames carry new addresses. Without normalising, one bug becomes fifty issues and the spike after a release hides in the noise. The usual follow-up: why fingerprint on app frames instead of the top frame?

## Example
```ts
normaliseFrame('at renderCart (index.android.bundle?hash=9f2c:1:20431)');
// 'renderCart (index.android.bundle)'

groupCrashes(reports, { ignorePrefixes: ['com.facebook.', 'java.', 'node_modules/'], topN: 2 });
// [{ fingerprint: 'com.shop.pay.Gateway.send(Gateway.kt)\ncom.shop.pay.PayModule.charge(PayModule.kt)',
//    count: 2, firstSeen: 10, lastSeen: 20, reportIds: ['a1', 'a2'] }, ...]
```

## Rules
- `normaliseFrame` applies these steps in order: trim; remove a leading `at `; remove every hex address (`0x` followed by hex digits, any case); remove every `?` and what follows it up to the next `:` or `)`; remove every run of `:<digits>` that sits right before `)` or the end; collapse whitespace runs into one space and trim again.
- A frame is written `symbol (location)`, `symbol(location)` or just `symbol`. After normalising, it is a library frame when its symbol (the text before the first `(`, trimmed) or its location (the text inside the parentheses) starts with any of `ignorePrefixes`.
- Drop frames that are empty after normalising. The fingerprint is the first `topN` app frames joined with `\n`. If a report has no app frames, use its first `topN` normalised frames instead. A report with no frames has the fingerprint `''`.
- `firstSeen` and `lastSeen` are the smallest and largest timestamps in the group; reports can arrive in any order. `reportIds` keep input order.
- Sort groups by `count` descending, then `firstSeen` ascending, then `fingerprint` ascending.
- It must handle 20,000 reports in well under a second.
