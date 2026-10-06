export type CartItem = { id: string; qty: number; price: number };
export type CartState = { items: CartItem[] };
export type CartAction =
  | { type: 'add'; item: { id: string; price: number } }
  | { type: 'remove'; id: string }
  | { type: 'setQty'; id: string; qty: number };
export type Reducer = (state: CartState, action: CartAction) => CartState;
export type Total = (state: CartState) => number;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const qtyOf = (state: CartState, id: string) => state.items.find((i) => i.id === id)?.qty;

export function verifyCart(cartReducer: Reducer, cartTotal: Total): void {
  const apple = { id: 'apple', price: 3 };
  const pear = { id: 'pear', price: 5 };
  const empty: CartState = { items: [] };

  const one = cartReducer(empty, { type: 'add', item: apple });
  assert(one.items.length === 1 && qtyOf(one, 'apple') === 1, 'add puts a new item in with qty 1');
  assert(empty.items.length === 0, 'add must not change the state it was given');

  const two = cartReducer(one, { type: 'add', item: apple });
  assert(two.items.length === 1 && qtyOf(two, 'apple') === 2, 'adding the same item again raises its qty');
  assert(qtyOf(one, 'apple') === 1, 'add must not change the state it was given');

  const mixed = cartReducer(two, { type: 'add', item: pear });
  assert(cartTotal(mixed) === 2 * 3 + 1 * 5, 'the total is the sum of qty × price');
  assert(cartTotal(empty) === 0, 'an empty cart totals 0');

  const removed = cartReducer(mixed, { type: 'remove', id: 'apple' });
  assert(qtyOf(removed, 'apple') === undefined && removed.items.length === 1, 'remove deletes the whole line');

  const set = cartReducer(mixed, { type: 'setQty', id: 'pear', qty: 4 });
  assert(qtyOf(set, 'pear') === 4, 'setQty sets the quantity');
  const zero = cartReducer(mixed, { type: 'setQty', id: 'pear', qty: 0 });
  assert(qtyOf(zero, 'pear') === undefined, 'setQty 0 deletes the line');
  const negative = cartReducer(mixed, { type: 'setQty', id: 'pear', qty: -2 });
  assert(qtyOf(negative, 'pear') === undefined, 'a negative qty deletes the line');
}
