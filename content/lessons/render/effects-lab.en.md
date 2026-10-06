---
id: render-effects-lab
topic: render/effects
kind: lab
readMinutes: 12
---
# Find and prove a screen memory leak

## The case
QA reports that opening and closing the order details screen 30 times makes the app use far more memory, and it never comes back down. On older phones the OS eventually kills the app. You suspect the screen's effects. Your job: reproduce the leak, find what is being kept alive, fix it, and show a number that proves the fix.

## Reproduce it
Paste this into a test app. It has three classic leaks: listeners that are never removed, an interval that is never cleared, and a module-level cache holding a closure that keeps a large array alive. The `stats` object is a cheap counter you will use as your first signal.

```ts
import { useEffect, useState } from 'react';
import { AppState, Button, Keyboard, Text, View } from 'react-native';

export const stats = { mounted: 0, listeners: 0, timers: 0 };
const cache = new Map<string, () => number>();

function OrderDetails({ orderId }: { orderId: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    stats.mounted++;
    const rows = Array.from({ length: 100_000 }, (_, i) => ({ i, label: `row ${i}` }));
    cache.set(`${orderId}-${Date.now()}`, () => rows.length); // keeps rows alive

    AppState.addEventListener('change', () => setTick((t) => t + 1));
    Keyboard.addListener('keyboardDidShow', () => setTick((t) => t + 1));
    stats.listeners += 2;
    setInterval(() => setTick((t) => t + 1), 1000);
    stats.timers++;

    return () => { stats.mounted--; };
  }, [orderId]);

  return <Text>Order {orderId}, tick {tick}</Text>;
}

export function LeakHarness() {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Button title="Toggle screen" onPress={() => setOpen((o) => !o)} />
      <Button title="Log stats" onPress={() => console.log(JSON.stringify(stats))} />
      {open && <OrderDetails orderId="42" />}
    </View>
  );
}
```

- Press "Toggle screen" 20 times (10 open/close cycles), then "Log stats".
- `mounted` goes back to 0 because the cleanup decrements it, but `listeners` and `timers` keep rising. That gap is the leak: the component is gone, but its subscriptions are not.
- In development with Strict Mode, each mount runs the effect twice, so the counters climb twice as fast. That is not a separate bug; it shows the cleanup is incomplete.

## Measure
Use three layers. Each answers a different question.

JS heap: React Native DevTools (the default debugger from RN 0.76, Hermes only).
- Open DevTools from the Dev Menu or by pressing `j` in the Metro terminal, then open the Memory panel.
- If the panel offers a button to force garbage collection, press it. Take a heap snapshot: this is the baseline.
- Run 10 open/close cycles, force GC again, take a second snapshot.
- Switch the second snapshot's view to the comparison with the first. Sort by size delta and use the class filter to search for names from your code, such as `OrderDetails` or the label strings.
- Select a retained object and read its retainers path. It tells you who still holds it: here, the `cache` Map holding a closure holding `rows`, and the listener registries of `AppState` and `Keyboard` holding closures that reference `setTick`.
- DevTools connects to development builds only. Use it to find what is retained; the extra dev memory (dev tools, source maps, Strict Mode) affects totals, not which of your objects survive.

Native process memory, in a release build.
- iOS: in Xcode, Product > Profile builds the Release configuration by default and opens Instruments. Choose the Allocations template. After each open/close cycle, use Allocations' mark generation action. Each generation shows memory allocated since the previous mark that is still alive. The Hermes heap lives in native memory, so JS growth shows up here too. If generations show little growth, also watch the persistent bytes of All Anonymous VM, where Hermes keeps its heap.
- The Leaks instrument finds native memory that nothing references any more, such as retain cycles in Objective-C or Swift. A JS leak is still referenced, so Leaks will usually show nothing for it. A clean Leaks run does not clear the JS side.
- Android: run a profileable or release-like build (profileable release builds need Android 10 or later) and open the Android Studio Profiler's memory view. Watch the total and the Native category, force a garbage collection between cycles, and take a heap dump if you suspect Java or Kotlin objects. The Hermes heap is not part of the Java heap; depending on the device it is counted under Native or Others, so watch the total, and a Java heap dump will not show your JS objects.
- LeakCanary is a debug-build library that detects destroyed Activities, Fragments and Views that are still reachable. Add it when you suspect a native module keeps an Activity or Context alive. It does not see the JS heap.

## Read the signal
- Normal: memory rises while the screen is open, then drops back near the baseline after the screen closes and GC runs. The graph is a sawtooth that returns to the same floor.
- Leak: the floor itself rises by about the same amount every cycle. The graph is a staircase, and forcing GC does not bring it down.
- Example from one run (you will see different numbers on your device): the baseline JS heap was 38 MB; after 10 cycles and a forced GC it was 96 MB, about 6 MB per cycle. The comparison view showed roughly a million new `row` objects and 10 copies of the effect's closures still retained.
- Example in Instruments, release build: each generation added about 6 MB of persistent memory, and none of it was freed in later generations.
- The counters agree: `listeners: 20`, `timers: 10` with `mounted: 0`. When the counter, the snapshot and the native graph all point the same way, you have the cause, not a guess.

## Fix
Undo every side effect in the cleanup, and bound the cache.

```ts
const MAX_CACHED = 5;
const cache = new Map<string, number>();

function remember(key: string, value: number) {
  cache.set(key, value);
  if (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

useEffect(() => {
  stats.mounted++;
  const rows = Array.from({ length: 100_000 }, (_, i) => ({ i, label: `row ${i}` }));
  remember(orderId, rows.length); // store the result, not a closure over rows

  const appSub = AppState.addEventListener('change', () => setTick((t) => t + 1));
  const kbSub = Keyboard.addListener('keyboardDidShow', () => setTick((t) => t + 1));
  stats.listeners += 2;
  const id = setInterval(() => setTick((t) => t + 1), 1000);
  stats.timers++;

  return () => {
    appSub.remove();
    kbSub.remove();
    clearInterval(id);
    stats.mounted--;
    stats.listeners -= 2;
    stats.timers--;
  };
}, [orderId]);
```

- Call `remove()` on the exact subscription you created. A `NativeEventEmitter` subscription works the same way. Do not use `removeAllListeners`, which also removes other components' listeners.
- A module-level cache lives as long as the app. Cache small results, key them by something stable, and cap the size.

## Measure again
- Repeat the same steps: same build type, same number of cycles, GC before each snapshot.
- Counters after 10 cycles: `{"mounted":0,"listeners":0,"timers":0}`. In Strict Mode they still return to 0, which shows the cleanup is complete.
- Example (your numbers will differ): baseline 38 MB, after 10 cycles 39 MB. The comparison view shows no retained `OrderDetails` closures and no `row` objects; the cache holds one number for order 42.
- Example in Instruments, release build: generations after the first stay under 0.3 MB each and do not accumulate. The graph is a sawtooth again.
- To check a small leak, raise the count to 50 cycles: a small leak hides in noise over a few cycles and becomes a clear staircase over many.

## Say it in the interview
"I reproduced it with a harness that mounts and unmounts the screen in a loop, and added counters for live listeners and timers. Listeners kept rising while mounted stayed at zero. Two heap snapshots in React Native DevTools, compared after forcing GC, showed the screen's closures retained by the AppState and Keyboard listeners, and a module cache holding a large array. I removed each subscription in the cleanup, cleared the interval and capped the cache. Then I confirmed in a release build with Instruments generations: memory per cycle went from about 6 MB to near zero, and the counters returned to zero."

## Related
`render-effects-core`, `maintain-regression-core`, `maintain-crash-core`, `native/modules-android`
