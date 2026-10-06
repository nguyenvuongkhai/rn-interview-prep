---
id: debug-js-lab
topic: debug/js
kind: lab
readMinutes: 12
---
# Wrong total after pull to refresh: trace it to the line

## The case
A customer applied a coupon, pulled to refresh the Order screen, and saw the correct total of 95 for a moment, then the old total of 120 came back. Nobody can reproduce it on office Wi-Fi. There is no crash, only wrong data. Your job: reproduce it, find the exact line that writes the wrong value, fix it, and prove the fix.

## Reproduce it
The repro uses a fake API with fixed delays: the first request takes 4 seconds, later ones 300 ms. It copies the total when the request starts, as a real server would. Paste this into a test app.

```ts
import { useCallback, useEffect, useState } from 'react';
import { Button, RefreshControl, ScrollView, Text } from 'react-native';

type Order = { orderId: string; total: number };

let serverTotal = 120;
let requestCount = 0;

export function applyCouponOnServer(): void {
  serverTotal = 95;
}

export function fetchOrder(orderId: string): Promise<Order> {
  requestCount += 1;
  const delay = requestCount === 1 ? 4000 : 300; // first request is slow
  const snapshot: Order = { orderId, total: serverTotal };
  return new Promise((resolve) => setTimeout(() => resolve(snapshot), delay));
}

export function OrderScreen({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchOrder(orderId);
    setOrder(data);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Button title="Apply coupon on server" onPress={applyCouponOnServer} />
      <Button title="Refresh" onPress={onRefresh} />
      <Text>{`Total: ${order ? order.total : '...'}`}</Text>
    </ScrollView>
  );
}
```

- Open the screen; the first load takes 4 seconds. Within that time, press "Apply coupon on server", then pull to refresh (or press "Refresh", which calls the same handler and is easier on a simulator).
- After about 300 ms the screen shows `Total: 95`. About 4 seconds after opening, it flips to `Total: 120`.
- Reload the app before each attempt, because `requestCount` lives in the module.

## Measure
The cause could be the server, a mapping bug that reads the wrong field, or the order in which responses arrive.

Structured logs with a request id: which request wrote the value?
- Give every call an id and log one JSON line when it starts and when it returns. Use `JSON.stringify`: the console keeps a reference to an object, so expanding it later shows its current state, not the state at that moment.

```ts
let latestId = 0;

const load = useCallback(async (reason: 'mount' | 'refresh') => {
  const requestId = ++latestId;
  const startedAt = Date.now();
  console.log(JSON.stringify({ event: 'order_request', requestId, reason }));
  const data = await fetchOrder(orderId);
  console.log(JSON.stringify({ event: 'order_response', requestId, total: data.total, ms: Date.now() - startedAt }));
  setOrder(data);
}, [orderId]);
```

- Pass `'mount'` from the effect and `'refresh'` from `onRefresh`, then repeat the steps. Example output from one run (your timings will differ):

```ts
{"event":"order_request","requestId":1,"reason":"mount"}
{"event":"order_request","requestId":2,"reason":"refresh"}
{"event":"order_response","requestId":2,"total":95,"ms":302}
{"event":"order_response","requestId":1,"total":120,"ms":4004}
```

React Native DevTools: what does the code see at the moment it writes state? It is the default debugger from RN 0.76 and runs on development builds.
- Press `j` in the terminal running Metro, or open it from the Dev Menu. Open the Sources panel and find the file with `OrderScreen`.
- Right-click the line number of `setOrder(data)` and add a conditional breakpoint with `requestId !== latestId`. It pauses only when a stale response is about to be applied.
- Repeat the steps. The debugger pauses about 4 seconds after opening. In the Scope section read `requestId` (1), `data.total` (120) and, under the closure, `latestId` (2). If the condition cannot see `latestId`, use a plain breakpoint and read the values by hand.
- Read the call stack. The top frame is `load`, resumed after the `await`; below it are promise and timer frames, not the refresh handler, so this is a late callback. Async frames vary by version, so rely on `requestId` to link the response to its request.
- While paused, the whole JS thread stops, including timers. A breakpoint early in `load` can change the timing and hide the race; this one sits at the end, after both responses have arrived.
- A `debugger;` statement there pauses only when a debugger is attached; otherwise it does nothing.

React DevTools: which value does the component actually hold?
- In the Components panel inside React Native DevTools, select `OrderScreen`. Its hooks list shows the `order` state.
- Repeat the steps and watch it: `total: 95`, then `total: 120` a few seconds later. The prop `orderId` never changes, so the component's own state was overwritten, not fed a new prop.

Network: what did the server return, and when?
- From RN 0.83, React Native DevTools has a Network panel (it records `fetch`, `XMLHttpRequest` and `<Image>`): filter for the order endpoint and compare start and end times. On older versions use a proxy such as Charles or Proxyman, or send the id in an `x-request-id` header and find it in backend logs. You are looking for two overlapping requests where the first to start finished last.

## Read the signal
- Two requests overlapped, and responses arrived in the opposite order: 2 at about 300 ms, 1 at about 4000 ms. The last `order_response` in the example log belongs to the older request.
- Each response is correct for its moment: request 1 really did see 120. The mapping and the server are fine. The data is not wrong, it is old, and the code applies whatever arrives last.
- The conditional breakpoint confirms the exact line: it stopped on `setOrder(data)` with `requestId` 1 while `latestId` was 2. React DevTools shows the result of that line: state going from 95 back to 120.
- Logs give the order, the breakpoint names the line, React DevTools shows the effect. Together they prove a race.

## Fix
Apply a response only if it belongs to the latest request. Keep the counter in a ref: per instance, and no extra render.

```ts
const latestIdRef = useRef(0);

const load = useCallback(async (reason: 'mount' | 'refresh') => {
  const requestId = ++latestIdRef.current;
  const data = await fetchOrder(orderId);
  if (requestId !== latestIdRef.current) {
    console.log(JSON.stringify({ event: 'order_response_ignored', requestId, latestId: latestIdRef.current, reason }));
    return;
  }
  console.log(JSON.stringify({ event: 'order_response_applied', requestId, total: data.total, reason }));
  setOrder(data);
}, [orderId]);

useEffect(() => {
  void load('mount');
  return () => {
    latestIdRef.current += 1; // responses after unmount or an orderId change are now stale
  };
}, [load]);
```

- With a real `fetch`, also use an `AbortController`: keep it in a ref, call `abort()` before starting a new request, and pass `signal` to `fetch`. Treat the resulting `AbortError` as expected, not as a failure.
- Keep the id check even with abort. A response that is already being parsed, or a library that ignores the signal, can still resolve after you abort.

## Measure again
- Same steps: reload, open, apply the coupon, refresh within 4 seconds.
- Example output after the fix (your timings will differ):

```ts
{"event":"order_response_applied","requestId":2,"total":95,"reason":"refresh"}
{"event":"order_response_ignored","requestId":1,"latestId":2,"reason":"mount"}
```

- The screen stays on `Total: 95`. In React DevTools the `order` state changes once and then stays. A breakpoint on `setOrder(data)` with the condition `requestId !== latestIdRef.current` never pauses, because the stale response returns before reaching it.
- Turn the repro into a unit test with fake timers, which control which response arrives first.

The test uses the RNTL v12–v13 API. In RNTL v14 (React 19, RN 0.78 or later), `render`, `fireEvent` and `act` are async: write `await render(...)` and `await fireEvent.press(...)`.

```ts
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { OrderScreen } from './OrderScreen';

jest.useFakeTimers();

test('an older response never overwrites a newer one', async () => {
  render(<OrderScreen orderId="42" />); // request 1: 4000 ms, total 120
  fireEvent.press(screen.getByText('Apply coupon on server'));
  fireEvent.press(screen.getByText('Refresh')); // request 2: 300 ms, total 95

  await act(async () => { await jest.advanceTimersByTimeAsync(300); });
  expect(screen.getByText('Total: 95')).toBeTruthy();

  await act(async () => { await jest.advanceTimersByTimeAsync(4000); });
  expect(screen.getByText('Total: 95')).toBeTruthy(); // shows 120 before the fix
});
```

- Run it against the old code first and watch it fail on the last line; a test that never failed proves nothing. `advanceTimersByTimeAsync` (Jest 29.5 and later) lets promises settle between timers. In a real project, mock the API module instead of using module-level counters.
- Keep the logs: in a release build, where no debugger attaches, they show whether the race still happens.

## Say it in the interview
"The Order screen sometimes showed the old total after pull to refresh, so I suspected two overlapping requests. I added structured logs with a request id and saw request 2 return in 300 ms and request 1 return after 4 seconds, applied last. A conditional breakpoint on `setOrder` with `requestId !== latestId` paused exactly there, and React DevTools showed the state flipping from 95 back to 120. I fixed it by tracking the latest request id in a ref and ignoring stale responses, plus an `AbortController` for real fetches. Then I wrote a fake-timer test that reproduces the response order, watched it fail on the old code and pass on the fix."

## Related
`debug-js-core`, `state-async-core`, `testing-unit-lab`, `testing-unit-core`, `render-effects-core`
