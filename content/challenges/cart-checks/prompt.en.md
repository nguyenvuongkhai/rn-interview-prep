## Task
This time you write the tests, not the code. Write `verifyCart(cartReducer, cartTotal)`. It must throw an `Error` when the cart code breaks any rule below, and return normally when the code is correct.

The cart state is `{ items: { id, qty, price }[] }`. The rules:

- `add` with `{ id, price }` puts the item in with `qty: 1`, or raises `qty` by 1 if the id is already there.
- `remove` with an `id` deletes that line completely.
- `setQty` with an `id` and a `qty` sets the quantity; a `qty` of 0 or less deletes the line.
- The reducer never changes the state it was given; it returns a new one.
- `cartTotal(state)` is the sum of `qty * price` over all lines, and 0 for an empty cart.

Your code only has `console`, not `expect`, so write small checks that throw.

## Why interviewers ask
A unit test is only as good as the bugs it can catch. The hidden tests pass your `verifyCart` a correct cart and several broken ones, each with exactly one bug. Your checks must stay quiet on the correct one and throw on every broken one. That is the same thinking as writing a test that fails before a fix and passes after it.

## Example
```ts
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const one = cartReducer({ items: [] }, { type: 'add', item: { id: 'apple', price: 3 } });
assert(one.items.length === 1 && one.items[0].qty === 1, 'add puts a new item in with qty 1');
```

## Rules
- Do not throw for a correct cart.
- Each broken cart has one bug; one check per rule is enough to catch it.
- Use your own small data, such as two items with different prices.
