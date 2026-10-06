---
id: testing-unit-core
topic: testing/unit
kind: core
readMinutes: 6
---
## TL;DR
A unit test is only as good as the assertion that would fail if the code broke. Most bad unit tests do not fail loudly; they pass while the code is broken: an un-awaited assertion, a matcher that checks less than you think, or state left over from the previous test. Test pure logic (reducers, selectors, helpers) directly, mock only at the boundaries, control time with fake timers, and make every test build its own state.

## Under the hood
### Structure and matchers
`describe` groups tests, `it` (or `test`) defines one, and `expect` asserts. Within a file Jest runs tests one after another, in order; parallelism happens between files, and each file has its own module registry.
- `toBe` uses `Object.is`, so on objects it checks identity. `toEqual` compares recursively by value and ignores properties set to `undefined`; `toStrictEqual` does not.
- `toThrow` needs a function: `expect(() => parse('')).toThrow()`.
- `toHaveBeenCalledWith` passes if any recorded call matches. Use `toHaveBeenCalledTimes`, `toHaveBeenLastCalledWith` or `toHaveBeenNthCalledWith` when the exact call matters.

### Mocks
`jest.fn()` records every call in `mock.calls`. `jest.mock('./api')` replaces the module in the registry, so every module that imports it gets the mock. babel-jest hoists `jest.mock` above the imports, which is why it works below them. A factory may only reference outer variables prefixed with `mock`, and those must be initialised before the factory runs.

### Async
Return or `await` every promise the test depends on. `await expect(p).resolves.toBe(x)` and `await expect(p).rejects.toThrow('msg')` both need the `await`; without it the test finishes first and passes. An `async` test does not need `done`.

### Fake timers
`jest.useFakeTimers()` replaces `setTimeout`, `setInterval` and `Date`. `jest.advanceTimersByTime(ms)` fires due timers synchronously, but it does not wait for promises, so a timer scheduled after an `await` does not exist yet. Use `await jest.advanceTimersByTimeAsync(ms)` (Jest 29.5 and later) for code that mixes promises and timers, and `jest.setSystemTime` to pin `Date.now()`.

```ts
it('debounces search', () => {
  jest.useFakeTimers();
  const search = jest.fn();
  const onChange = debounce(search, 300);
  onChange('a');
  onChange('ab');
  jest.advanceTimersByTime(300);
  expect(search).toHaveBeenCalledTimes(1);
  expect(search).toHaveBeenLastCalledWith('ab');
});
```

### Pure logic
Reducers and selectors need no mocks: input in, output out. `Object.freeze` the input state so a mutating reducer fails the test. For a memoized selector, call it twice with the same state and assert `toBe`.

### Coverage
Coverage reports which lines and branches ran, not which behaviour was checked. A test with no assertions still adds coverage. Use it to find untested code, and check branch coverage rather than line coverage.

## Interview angle
- "A test passed but the feature was broken. How?" Missing `await`, `toHaveBeenCalledWith` matching an earlier call, assertions inside a loop over an empty array, or `it.only` skipping the rest of the file.
- "A test fails only on CI or only when run alone." Order dependence: shared module state, unreset mocks, real time.

## Common pitfalls
- Asserting `resolves` or `rejects` without `await`
- A `try`/`catch` test without `expect.assertions`
- Using `toBe` on objects built by the code under test
- Mutating a shared fixture, which makes tests depend on order
- Not resetting mocks; set `clearMocks` or `restoreMocks` in the config
- Calling `advanceTimersByTime` before the code has scheduled its timer
- Treating a coverage percentage as proof of correctness

## Related
`testing/components`, `testing-e2e-core`, `state-redux-core`, `state-async-core`
