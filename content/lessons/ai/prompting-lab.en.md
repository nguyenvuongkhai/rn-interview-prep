---
id: ai-prompting-lab
topic: ai/prompting
kind: lab
readMinutes: 11
---
# Fix a memory leak with an AI assistant, and prove it

## The case
QA reports that memory climbs every time the user opens and closes the Activity screen, and it never comes back down. The release is in two days, so you want to fix it fast, with an AI assistant. The app runs RN 0.77 with React 18.3. The screen subscribes to `AppState` to refresh when the app returns to the foreground. Your job: get a correct fix out of the assistant, catch it when it is wrong, and show numbers that prove the final fix works. The assistant writes code; checking it stays your job.

## Reproduce it
Here is the screen, reduced to the part that matters. The `stats` counter comes from the memory leak lab in `render-effects-lab`: it is a cheap first signal for live subscriptions.

```ts
import { useEffect, useState } from 'react';
import { AppState, Text } from 'react-native';

export const stats = { listeners: 0 };

export function ActivityScreen({ userId }: { userId: string }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const samples = Array.from({ length: 50_000 }, (_, i) => ({ i, userId }));
    AppState.addEventListener('change', (next) => {
      setLabel(`${next}: ${samples.length} samples`);
    });
    stats.listeners++;
  }, [userId]);

  return <Text>{label}</Text>;
}
```

- Mount and unmount the screen 10 times with a toggle button, then log `stats`. `listeners` reads 10 although no screen is open.
- Each listener stays in the `AppState` registry, and its closure keeps `samples` and `setLabel` alive. The screen is gone, but its memory is not.

Under time pressure, the first prompt is often this:

```text
My screen leaks memory, fix it.
```

## Measure
Here, measuring means checking the assistant's answer before you trust it. A typical answer to the vague prompt sounds confident and looks plausible:

```ts
const onChange = useCallback((next: AppStateStatus) => {
  setLabel(next);
}, []);

useEffect(() => {
  AppState.addEventListener('change', onChange);
  return () => AppState.removeEventListener('change', onChange);
}, [onChange]);
```

It also suggested wrapping the screen in `React.memo`. Check it in three ways.

- Read the diff line by line. `useCallback` and `React.memo` change how often things re-render; neither changes when a subscription ends. The diff also dropped `samples` and the `userId` dependency, so it quietly changed behaviour you did not ask it to change.
- Check every API against the version you have installed, not against what the assistant says. `AppState.addEventListener` has returned a subscription with `remove()` since RN 0.65, and `AppState.removeEventListener` was deprecated then and later removed. Search the AppState type definitions inside `node_modules/react-native` for `removeEventListener`: on RN 0.77 it is not there. A type check flags the line, and at runtime the cleanup throws a TypeError when the screen unmounts.
- Run the same counter and heap check as before. You do not need to repeat the whole method: follow `render-effects-lab` for the heap snapshot comparison in React Native DevTools and for Instruments or the Android Studio Profiler in a release or profile build. Here, the first unmount throws `TypeError: AppState.removeEventListener is not a function`: a red box in a dev build, and in a release build an uncaught error like this takes the app down. The leak is not fixed, and the 'fix' adds a crash.

## Read the signal
- Example from one run (your numbers will differ): before any change, the JS heap after a forced GC grew by about 4 MB per open and close cycle, and the snapshot comparison showed the `samples` arrays retained through the `AppState` listeners. With the suggested fix applied, the first close of the screen threw a TypeError, so the 'fix' turned a leak into a crash.
- The answer was wrong because the prompt gave the assistant nothing to work with.
- No version. Many examples of `AppState` code were written before RN 0.65, when `removeEventListener` was the pattern. Without "RN 0.77", the assistant has no reason to prefer the current API.
- No code. It never saw the effect, so it guessed the most common React advice for "performance": memoisation.
- No evidence. "Leaks memory" could mean re-renders, retained objects or native memory. A counter that rises per cycle and a snapshot that names the retainer point straight at the subscription.
- No definition of done. The assistant stopped when the code looked reasonable, because nothing told it what "fixed" means.

## Fix
Write a prompt with the facts, the evidence and a checkable goal. Ask for the cause before the code, so wrong reasoning shows up before you read a diff.

```text
RN 0.77, React 18.3, TypeScript, Jest with React Native Testing Library.
File: src/screens/ActivityScreen.tsx (pasted below).
Bug: memory grows on every open and close of this screen.
Evidence: after 10 open/close cycles in a release build, a counter
of live AppState listeners reads 10 with the screen closed. A heap
snapshot comparison shows the samples arrays retained by the
AppState change listeners, about 4 MB per cycle.
Constraints: no new dependencies, keep the props and the label text,
use only APIs that exist in RN 0.77.
First explain the cause. Then give the smallest fix. Then write a test
that fails before the fix and passes after it.
```

The answer explained that the effect has no cleanup, so each mount adds a listener that is never removed. The fix keeps the subscription the call returns and removes it in the cleanup:

```ts
useEffect(() => {
  const samples = Array.from({ length: 50_000 }, (_, i) => ({ i, userId }));
  const sub = AppState.addEventListener('change', (next) => {
    setLabel(`${next}: ${samples.length} samples`);
  });
  stats.listeners++;

  return () => {
    sub.remove();
    stats.listeners--;
  };
}, [userId]);
```

The test uses the RNTL v12–v13 API; in RNTL v14 (React 19, RN 0.78 or later), `render` is async, so write `await render(...)`.

The test replaces `AppState.addEventListener` with a mock that returns `{ remove }`, then unmounts and asserts that `remove` was called:

```ts
import { render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { ActivityScreen } from './ActivityScreen';

test('removes the AppState subscription on unmount', () => {
  const remove = jest.fn();
  const spy = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });

  const { unmount } = render(<ActivityScreen userId="u1" />);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();

  unmount();
  expect(remove).toHaveBeenCalledTimes(1);

  spy.mockRestore();
});
```

- A `NativeEventEmitter` subscription works the same way: keep what `addListener` returns and call `remove()` on it in the cleanup.
- Do not accept `removeAllListeners` as a fix. It also removes listeners that other parts of the app own.

## Measure again
- Run the test against the old code first. It fails on the last assertion, because nothing calls `remove`. With the fix it passes. A test you have never seen fail proves nothing.
- Repeat the leak check exactly as before: same build type, same 10 cycles, GC before each snapshot. `listeners` reads 0 with the screen closed.
- Example (your numbers will differ): growth per cycle went from about 4 MB to under 0.1 MB, and the comparison view shows no retained `samples` arrays. In Instruments generations or the Android Studio Profiler, release build, the graph is a sawtooth that returns to the same floor.
- What you still checked yourself: that `remove()` exists in the installed RN types, that the diff touches only this effect, that the label text is unchanged, and a search for other `addEventListener` and `addListener` calls whose return value is thrown away. That search found one more screen with the same bug.

## Say it in the interview
"We had a screen whose memory grew on every open and close, two days before a release, and I used an AI assistant to speed up the fix. My first prompt was vague, and it suggested `useCallback` plus `AppState.removeEventListener`, which no longer exists in our RN version; I caught it by reading the diff and checking the types, and the first unmount crashed with a TypeError. I rewrote the prompt with the RN version, the component, a measurement showing about 4 MB per cycle and a definition of done, and asked for the cause first, then the smallest fix, then a test that fails before and passes after. It identified the missing cleanup and returned `sub.remove()` with an RNTL test. I watched the test go red then green, confirmed the per-cycle growth was flat in a release build, and found a second screen with the same pattern. The assistant saved me time on the code; the verification was mine."

## Related
`ai-prompting-core`, `render-effects-lab`, `render-effects-core`, `ai/workflow`, `testing-components-core`
