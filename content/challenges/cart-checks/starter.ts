export type CartItem = { id: string; qty: number; price: number };
export type CartState = { items: CartItem[] };
export type CartAction =
  | { type: 'add'; item: { id: string; price: number } }
  | { type: 'remove'; id: string }
  | { type: 'setQty'; id: string; qty: number };
export type Reducer = (state: CartState, action: CartAction) => CartState;
export type Total = (state: CartState) => number;

export function verifyCart(cartReducer: Reducer, cartTotal: Total): void {
  // TODO: throw an Error when cartReducer or cartTotal breaks a rule
}
