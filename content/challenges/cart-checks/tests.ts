import { verifyCart } from './solution';
import type { CartState, Reducer, Total } from './solution';

const correct: Reducer = (state, action) => {
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
      return {
        items: action.qty <= 0
          ? state.items.filter((i) => i.id !== action.id)
          : state.items.map((i) => (i.id === action.id ? { ...i, qty: action.qty } : i)),
      };
  }
};
const total: Total = (state: CartState) => state.items.reduce((sum, i) => sum + i.qty * i.price, 0);

test('accepts a correct cart', () => {
  verifyCart(correct, total);
}, { category: 'basic' });

test('catches add creating a second line for the same item', () => {
  const bad: Reducer = (state, action) =>
    action.type === 'add' ? { items: [...state.items, { ...action.item, qty: 1 }] } : correct(state, action);
  expect(() => verifyCart(bad, total)).toThrow();
}, { category: 'basic' });

test('catches remove that only lowers the quantity', () => {
  const bad: Reducer = (state, action) =>
    action.type === 'remove'
      ? { items: state.items.flatMap((i) => (i.id !== action.id ? [i] : i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : [])) }
      : correct(state, action);
  expect(() => verifyCart(bad, total)).toThrow();
}, { category: 'edge-case', hidden: true });

test('catches setQty 0 keeping the line', () => {
  const bad: Reducer = (state, action) =>
    action.type === 'setQty' && action.qty === 0
      ? { items: state.items.map((i) => (i.id === action.id ? { ...i, qty: 0 } : i)) }
      : correct(state, action);
  expect(() => verifyCart(bad, total)).toThrow();
}, { category: 'edge-case', hidden: true });

test('catches a negative qty kept in the cart', () => {
  const bad: Reducer = (state, action) =>
    action.type === 'setQty' && action.qty < 0
      ? { items: state.items.map((i) => (i.id === action.id ? { ...i, qty: action.qty } : i)) }
      : correct(state, action);
  expect(() => verifyCart(bad, total)).toThrow();
}, { category: 'edge-case', hidden: true });

test('catches a reducer that changes the state it was given', () => {
  const bad: Reducer = (state, action) => {
    if (action.type !== 'add') return correct(state, action);
    const found = state.items.find((i) => i.id === action.item.id);
    if (found) found.qty += 1;
    else state.items.push({ ...action.item, qty: 1 });
    return state;
  };
  expect(() => verifyCart(bad, total)).toThrow();
}, { category: 'edge-case', hidden: true });

test('catches a total that ignores quantity', () => {
  const badTotal: Total = (state) => state.items.reduce((sum, i) => sum + i.price, 0);
  expect(() => verifyCart(correct, badTotal)).toThrow();
}, { category: 'edge-case', hidden: true });
