---
id: performance-js-thread-lab
topic: performance/js-thread
kind: lab
readMinutes: 10
---
# Taps ignored after launch: find the long task

## The case
For the first few seconds after launch, taps do nothing: a button only reacts once the app "wakes up", and the first screen also takes a while to appear. Nothing crashes and nothing shows in the logs. In the interview, the follow-up is always "how did you know what was blocking, and how did you prove the fix worked?"

The cause here: at startup the app reads a large JSON blob from storage, parses it, filters and sorts tens of thousands of records and builds a lookup index, all synchronously, before the first screen can respond.

## Reproduce it
Paste this into a test app as `App.tsx`. `storedBlob` stands in for a string you would read with `AsyncStorage.getItem`; the read itself is native and async, but `JSON.parse` and everything after it runs on the JS thread.

```ts
import { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';

type Product = { id: string; name: string; price: number; tags: string[] };
type Index = Map<string, Product[]>;

function makeBlob(n: number): string {
  const rows: Product[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({ id: `p${i}`, name: `Product ${(i * 7919) % n}`, price: i % 500, tags: [`t${i % 50}`, `c${i % 7}`] });
  }
  return JSON.stringify(rows);
}
const storedBlob = makeBlob(50_000);
const appStart = performance.now();

export function buildIndex(blob: string): Index {
  const t0 = performance.now();
  const all: Product[] = JSON.parse(blob);
  const visible = all.filter((p) => p.price > 0).sort((a, b) => a.name.localeCompare(b.name));
  const index: Index = new Map();
  for (const p of visible) {
    for (const tag of p.tags) {
      const list = index.get(tag) ?? [];
      list.push(p);
      index.set(tag, list);
    }
  }
  console.log(`[perf] buildIndex ${Math.round(performance.now() - t0)} ms`);
  return index;
}

export default function App() {
  const [index, setIndex] = useState<Index>(() => buildIndex(storedBlob));
  const [taps, setTaps] = useState(0);

  useEffect(() => {
    console.log(`[perf] first screen ready ${Math.round(performance.now() - appStart)} ms`);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>{index.size} tags</Text>
      <Button title={`Tapped ${taps}`} onPress={() => setTaps((n) => n + 1)} />
      {__DEV__ && <Button title="Rebuild index" onPress={() => setIndex(buildIndex(storedBlob))} />}
    </View>
  );
}
```

- `buildIndex` runs inside the `useState` initialiser, so the first render cannot finish until it returns.
- `first screen ready` is a simple JS-side time-to-interactive marker: the first screen's first effect runs only after its first commit. It starts once the blob exists and does not include native startup; for cold start across releases, see `maintain-regression-core`.
- `Rebuild index` is a dev-only button that runs the same function again, so you can record a profile without racing the startup.
- Generating the blob is test scaffolding, so `appStart` is taken after it. If the freeze is too short on your phone, raise `50_000`.

## Measure
Use three tools, each for a different question.

- Which thread is blocked? Run a debug build, open the Dev Menu (shake the device, `Cmd+D` in the iOS Simulator, `Cmd+M` in the Android emulator) and turn on Perf Monitor. Relaunch and tap the button straight away. Watch the two counters: UI and JS.
- Where does the JS time go? Open React Native DevTools, the default debugger from RN 0.76, by pressing `j` in the Metro terminal or from the Dev Menu option that opens DevTools. Open the panel that records a JS CPU profile from Hermes' sampling profiler (the Performance panel, available from RN 0.83; on older versions see the Hermes profiling page of the RN docs for your version). Start recording, press `Rebuild index`, wait until the button responds, stop.
- How long, in numbers you can trust? Build a release build (for example `npx react-native run-android --mode release`) and read the `[perf]` lines with `adb logcat` filtered to `ReactNativeJS` on Android, or in the Xcode console on iOS. Cold start the app five times on the same device and note the median.

Perf Monitor and DevTools need a debug build, which runs much slower. Use them to find where the time goes, and take the numbers you report from the release build.

## Read the signal
Example numbers from one mid-range Android phone; yours will differ.

- Perf Monitor: UI stays near 60 FPS while JS drops to 0 or 1 for about two seconds. The native side is fine; the JS thread is busy, so touches reach native but no JS handler runs until it is free. If UI dropped too, you would look at native work instead.
- Flame chart: time runs left to right, and the width of a bar is how long that call ran. You see one wide bar for `buildIndex` spanning roughly 1.4 s. Below it, the stack splits into `JSON.parse`, the `sort` with `localeCompare` calls under it, and the indexing loop. Native built-ins may show under their own name or be grouped together. Use the bottom-up view, sorted by self time, to rank the functions.
- One wide bar means one long synchronous task: a frame lasts about 16.6 ms at 60 Hz, so a 1.4 s task blocks around 80 frames in a row. Many narrow bars packed with no gaps is a different problem, death by a thousand cuts: no single function to fix, so you cut how often the work runs.
- Release logs (example): `buildIndex 1400 ms`, `first screen ready 2300 ms`.

## Fix
Do only what the first frame needs, then do the rest in slices that give the thread back.

```ts
const yieldToUI = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function buildIndexInChunks(blob: string, budgetMs = 8): Promise<Index> {
  const t0 = performance.now();
  const all: Product[] = JSON.parse(blob);
  const index: Index = new Map();
  let sliceStart = performance.now();
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    if (p.price > 0) {
      for (const tag of p.tags) {
        const list = index.get(tag) ?? [];
        list.push(p);
        index.set(tag, list);
      }
    }
    if (i % 200 === 0 && performance.now() - sliceStart > budgetMs) {
      await yieldToUI();
      sliceStart = performance.now();
    }
  }
  console.log(`[perf] index ready ${Math.round(performance.now() - t0)} ms`);
  return index;
}
```

In `App`, start with `useState<Index | null>(null)`, render a placeholder, and kick the work off from the first effect with `setTimeout(..., 0)` so the first frame paints first. Keep a `cancelled` flag in the effect cleanup so you never set state after unmount. `InteractionManager.runAfterInteractions` is another way to defer it; check its status in your RN version's docs.

- `setTimeout` yields a macrotask, so taps and frames run between slices. `await Promise.resolve()` would not; see `performance-js-thread-008`.
- The sort is gone from startup: sort a tag's list when that tag is opened, or save the data already sorted and indexed when you write it, so startup only reads.
- `JSON.parse` cannot be sliced. Shrink what you parse: split the blob into smaller keys, load only what the first screen needs, or keep the data in SQLite (for example `expo-sqlite` or `op-sqlite`) and query only the rows you show.

## Measure again
Same release build type, same device, five cold starts, compare medians. Example numbers; yours will differ.

- `first screen ready` drops from 2,300 ms to 600 ms. The longest a tap now waits is the one `JSON.parse` call, not the whole 1.4 s.
- Perf Monitor (debug build): JS dips while the slices run but no longer sits at 0; taps register between slices.
- Flame chart (point `Rebuild index` at the new function): the wide `buildIndex` bar becomes a row of short slices. One bar for `JSON.parse` remains, about 350 ms in this example; that is the next target.
- Slicing adds a little overhead, so indexing ends later than it would in one go. That is expected: slicing does not make work cheaper, it makes the app respond while the work runs.

## Say it in the interview
"Taps were dead for two seconds after launch. Perf Monitor showed UI at 60 and JS at 0, so it was the JS thread. A Hermes profile showed one 1.4-second task: parse, sort and index at startup. I rendered the first screen first, moved the indexing into time-boxed slices that yield with `setTimeout`, dropped the startup sort and cut what we parse. On release builds on the same phone, the median first-screen time went from 2.3 to 0.6 seconds, and the longest freeze shrank to the parse, which we are cutting next."

## Related
`performance-js-thread-core`, `maintain-regression-core`, `state-async-core`
