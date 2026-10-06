---
id: testing-unit-lab
topic: testing/unit
kind: lab
readMinutes: 11
---
# Prove a cart bug is fixed with a failing test

## The case
A customer reports a wrong cart total. They had two apples and a pear, typed 0 in the pear's quantity field to drop it, and the pear stayed with the old total. You must fix it and prove the fix with a unit test that fails on the current code, passes after the fix, and stays in the suite so the bug cannot come back unnoticed.

The cart uses the model from the `cart-checks` challenge: `CartState` is `{ items: { id, qty, price }[] }`, the reducer handles `add`, `remove` and `setQty`, and `cartTotal` sums `qty * price`. The rule: `setQty` with a `qty` of 0 or less deletes the line.

## Reproduce it
Here is the reducer as it ships. Someone added a guard so that an empty quantity field, which `Number('')` turns into 0, would not wipe the line. The guard uses `!action.qty`, and 0 is falsy, so a real 0 is ignored too.

```ts
// src/cart/cartReducer.ts
export type CartItem = { id: string; qty: number; price: number };
export type CartState = { items: CartItem[] };
export type CartAction =
  | { type: 'add'; item: { id: string; price: number } }
  | { type: 'remove'; id: string }
  | { type: 'setQty'; id: string; qty: number };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const found = state.items.some((i) => i.id === action.item.id);
      return {
        items: found
          ? state.items.map((i) => (i.id === action.item.id ? { ...i, qty: i.qty + 1 } : i))
          : [...state.items, { ...action.item, qty: 1 }],
      };
    }
    case 'remove':
      return { items: state.items.filter((i) => i.id !== action.id) };
    case 'setQty':
      if (!action.qty) return state; // BUG: meant to skip an empty field, also skips 0
      return {
        items: state.items.map((i) => (i.id === action.id ? { ...i, qty: action.qty } : i)),
      };
  }
}

export const cartTotal = (state: CartState): number =>
  state.items.reduce((sum, i) => sum + i.qty * i.price, 0);
```

In the app the symptom matches the report:
- Add two apples (price 3) and one pear (price 5). The total is 11.
- Type 0 in the pear's quantity field. The reducer returns the same state, so the store still holds the pear at quantity 1 and the total stays 11 instead of 6.
- A negative value is worse: it is stored as is, and the total goes down.

You could fix the line and tap through the app again, but that proves it once, on your device. A test proves it on every commit.

## Measure
Write the test before you touch the reducer. A reducer is pure, so the test needs no mocks and no React Native setup; the Jest config in the React Native template runs `.ts` test files as they are.

```ts
// src/cart/cartReducer.test.ts
import { cartReducer, cartTotal, type CartState } from './cartReducer';

const start: CartState = {
  items: [
    { id: 'apple', qty: 2, price: 3 },
    { id: 'pear', qty: 1, price: 5 },
  ],
};

describe('cartReducer', () => {
  describe('setQty', () => {
    it('removes the line when qty is set to 0', () => {
      const next = cartReducer(start, { type: 'setQty', id: 'pear', qty: 0 });
      expect(cartTotal(next)).toBe(6);
      expect(next.items).toEqual([{ id: 'apple', qty: 2, price: 3 }]);
    });

    it('removes the line when qty is negative', () => {
      const next = cartReducer(start, { type: 'setQty', id: 'pear', qty: -2 });
      expect(next.items).toHaveLength(1);
    });

    it('sets the quantity when qty is positive', () => {
      const next = cartReducer(start, { type: 'setQty', id: 'pear', qty: 4 });
      expect(cartTotal(next)).toBe(26);
    });
  });
});
```

Each test reads the same `start` object and never changes it, so order does not matter. The first assertion checks the number the customer saw; the second checks the state.

Run only this file and only these tests:

```text
npx jest cartReducer -t "removes the line"
```

The first argument is a pattern matched against test file paths. `-t` (long form `--testNamePattern`) filters by test name, matched against the full name including the describe blocks, so both "removes the line" tests run and the third is skipped. While you work, `npx jest cartReducer --watch` re-runs the file on every save.

On the buggy code the output looks like this (example output, trimmed; your paths and line numbers will differ):

```text
 FAIL  src/cart/cartReducer.test.ts
  ● cartReducer › setQty › removes the line when qty is set to 0

    expect(received).toBe(expected) // Object.is equality

    Expected: 6
    Received: 11

  ● cartReducer › setQty › removes the line when qty is negative

    expect(received).toHaveLength(expected)

    Expected length: 1
    Received length: 2
```

## Read the signal
Read a failure from the top:
- The line with `●` is the full test name: which rule broke.
- `Expected` is the value you wrote in the test; `Received` is what the code produced.
- `Received: 11` is exactly the old total, 2 × 3 + 1 × 5. The pear is still counted, which matches the customer's report. A different wrong number would point elsewhere: 8 (3 + 5) would mean a total that ignores quantity.
- A failing assertion throws, so Jest stops that test there; the `toEqual` after it did not run.

The red run is not a formality. A test that already passes on the broken code proves nothing about your fix: either it does not reach the buggy branch, or the bug is not where you think. Seeing it fail for the expected reason is what makes the later green meaningful.

Watch for tests that pass for the wrong reason:
- A test with no `expect` passes as long as nothing throws. Calling the reducer without checking the result adds coverage and catches nothing.
- An async assertion without `await`, such as `expect(p).rejects.toThrow()`, lets the test finish before the promise settles, so it passes. This is the trap in the `testing-unit-core` pitfalls. For code that should throw inside a `try`/`catch`, add `expect.assertions(1)`.
- If your new test is green on the first run, assume it is one of these before you assume the code is fine.

## Fix
Handle 0 and negative quantities as the rule says, and move the empty-field concern to where it belongs: the screen should not dispatch while the field is empty.

```ts
    case 'setQty':
      if (action.qty <= 0) {
        return { items: state.items.filter((i) => i.id !== action.id) };
      }
      return {
        items: state.items.map((i) => (i.id === action.id ? { ...i, qty: action.qty } : i)),
      };
```

## Measure again
Run the same command:

```text
npx jest cartReducer -t "removes the line"
```

Both tests now pass. Then run the whole suite with `npx jest` (or your project's test script): the fix changed shared logic, so every other test that builds a cart must still pass.

Optionally, run `npx jest cartReducer --coverage` and look at the `% Branch` and `Uncovered Line #s` columns for `cartReducer.ts`. The lines of the `qty <= 0` path should no longer appear under `Uncovered Line #s`. Your percentages will differ.

Coverage says the line ran, not that anything checked the result; a test with no assertion would mark the same branch covered. The proof is the test that failed before the fix and passes after it.

Keep the test and commit it with the fix. Once CI runs it on every pull request, anyone who brings the old guard back gets a red build that names the rule.

## Say it in the interview
"I reproduced the report with a failing unit test first: set the pear to 0 and expect the total to drop from 11 to 6. It failed with `Expected: 6, Received: 11`, which confirmed the line was kept and that my test reached the bug. The cause was a `!action.qty` guard that treated 0 as an empty field. I changed `setQty` to delete the line when `qty <= 0`, moved the empty-field check to the screen, saw the test go green and ran the full suite. The test stays in CI as a regression guard, and I checked that it fails for the right reason, not just that it passes."

## Related
`testing-unit-core`, `state-redux-core`, `cart-checks`
