---
id: testing-components-core
topic: testing/components
kind: core
readMinutes: 6
---
## TL;DR
React Native Testing Library (RNTL) renders components in Jest and lets you query and interact with them the way a user would. Query by role, label and text before `testID`, interact with userEvent, and await what the user would see with `findBy` or `waitFor`. Most flaky or brittle component tests come from three things: not waiting for async updates, state shared between tests, and assertions on implementation details.

## Under the hood
### Rendering and queries
`render` runs your component with React's test renderer in Node. There are no native views: host components such as `View`, `Text` and `TextInput` are plain elements whose props you can inspect. Queries come in three families:
- `getBy` returns one element and throws if there is none or more than one.
- `queryBy` returns the element or `null`. Use it to assert absence.
- `findBy` returns a promise that retries until the element appears or the timeout (1000 ms by default) runs out.

Each has an `All` variant that returns an array. Prefer `getByRole('button', { name: 'Save' })`, `getByLabelText` and `getByText`: they match what users and screen readers perceive, so they also check accessibility and survive refactors.

### Interacting
`fireEvent.press` or `fireEvent.changeText` calls one handler prop directly. userEvent (RNTL v12 and later) simulates a user: `user.press` runs the press-in and press-out sequence, and `user.type` focuses the input and emits key press and text change events per character before blurring. userEvent is async, so always `await` it.

```ts
test('saves the new name', async () => {
  const user = userEvent.setup();
  render(<EditNameForm initialName="An" />);
  await user.type(screen.getByLabelText('Name'), ' Nguyen');
  await user.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Saved')).toBeOnTheScreen();
});
```

`toBeOnTheScreen()` is a built-in RNTL matcher in recent versions (from v12.4); older projects get it from `@testing-library/jest-native`.

The examples use the RNTL v12–v13 API. In RNTL v14 (React 19 and RN 0.78 or later), `render`, `fireEvent` and `act` are async: write `await render(...)` and `await fireEvent.press(...)`.

### act and async
`act` makes sure updates and effects are flushed before assertions run. RNTL already wraps `render`, `fireEvent` and userEvent in it. The warning "not wrapped in act(...)" means an update happened outside those calls, usually a promise resolving after the test moved on. Fix it by awaiting the visible result, not by adding more `act`.

### Mocks and providers
Jest runs in Node, so native modules must be mocked, ideally with the mock a library ships, in the Jest setup file. A `jest.mock` factory replaces the whole module, so spread `jest.requireActual` when you only override one export. For context-based libraries, render inside real providers through a `renderWithProviders` helper: a store from `configureStore` with real reducers and a fresh `QueryClient` with `retry: false`, both created per test. Mock at the network boundary, not your own hooks. For navigation, a real `NavigationContainer` with a small stack is often sturdier than mocking hooks.

## Interview angle
- "A component test is flaky in CI." Reproduce in a loop, look for un-awaited async UI and shared state, and refuse timeout bumps as the fix.
- "A refactor broke 40 tests but nothing changed for users." Those tests checked structure; move them to role and text queries with explicit assertions.

## Common pitfalls
- Asserting with `getBy` right after async work instead of `findBy`
- Forgetting `await` before `waitFor` or userEvent
- A module-level `QueryClient` or store shared between tests
- Leaving TanStack Query's default retries on in tests
- Whole-screen snapshots and `testID` on every element
- Silencing act warnings instead of awaiting the result

## Related
`testing/unit`, `testing/e2e`, `state/redux`, `state/async`
