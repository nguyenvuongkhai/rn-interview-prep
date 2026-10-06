---
id: testing-unit-lab
topic: testing/unit
kind: lab
readMinutes: 11
---
# Chứng minh bug giỏ hàng đã được sửa bằng một test fail trước

## Tình huống
Một khách hàng báo tổng tiền giỏ hàng bị sai. Họ có hai quả táo và một quả lê, gõ 0 vào ô số lượng của quả lê để bỏ nó đi, nhưng quả lê vẫn nằm đó và tổng tiền giữ nguyên. Bạn phải sửa lỗi và chứng minh bản sửa bằng một unit test: fail trên code hiện tại, pass sau khi sửa, và ở lại trong suite để bug không quay lại mà không ai biết.

Giỏ hàng dùng đúng model của challenge `cart-checks`: `CartState` là `{ items: { id, qty, price }[] }`, reducer xử lý `add`, `remove` và `setQty`, còn `cartTotal` cộng `qty * price`. Quy tắc: `setQty` với `qty` bằng 0 hoặc nhỏ hơn thì xoá dòng đó.

## Dựng lại lỗi
Đây là reducer đang chạy trên production. Có người đã thêm một điều kiện chặn để ô số lượng bị bỏ trống, mà `Number('')` biến thành 0, không xoá mất dòng. Điều kiện đó dùng `!action.qty`, mà 0 là falsy, nên một số 0 thật cũng bị bỏ qua.

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
      if (!action.qty) return state; // BUG: định bỏ qua ô trống, nhưng bỏ qua cả số 0
      return {
        items: state.items.map((i) => (i.id === action.id ? { ...i, qty: action.qty } : i)),
      };
  }
}

export const cartTotal = (state: CartState): number =>
  state.items.reduce((sum, i) => sum + i.qty * i.price, 0);
```

Trong app, triệu chứng khớp với báo cáo:
- Thêm hai quả táo (giá 3) và một quả lê (giá 5). Tổng là 11.
- Gõ 0 vào ô số lượng của quả lê. Reducer trả về đúng state cũ, nên store vẫn giữ quả lê với số lượng 1 và tổng vẫn là 11 thay vì 6.
- Số âm còn tệ hơn: nó được lưu nguyên, và tổng tiền bị giảm.

Bạn có thể sửa dòng đó rồi bấm thử lại trong app, nhưng như vậy chỉ chứng minh được một lần, trên máy của bạn. Một test chứng minh nó ở mọi commit.

## Đo
Viết test trước khi chạm vào reducer. Reducer là hàm thuần, nên test không cần mock hay setup React Native; cấu hình Jest có sẵn trong template React Native chạy được file test `.ts` mà không cần thêm gì.

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

Mọi test đều đọc cùng object `start` và không thay đổi nó, nên thứ tự chạy không ảnh hưởng. Assertion đầu kiểm tra con số khách hàng nhìn thấy; assertion thứ hai kiểm tra state.

Chỉ chạy file này và chỉ những test này:

```text
npx jest cartReducer -t "removes the line"
```

Tham số đầu là pattern so với đường dẫn file test. `-t` (dạng dài `--testNamePattern`) lọc theo tên test, so với tên đầy đủ gồm cả các khối describe, nên cả hai test "removes the line" đều chạy còn test thứ ba bị skip. Trong lúc làm, `npx jest cartReducer --watch` chạy lại file mỗi lần bạn lưu.

Trên code có bug, output trông như sau (output ví dụ, đã rút gọn; đường dẫn và số dòng trên máy bạn sẽ khác):

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

## Đọc tín hiệu
Đọc một lỗi từ trên xuống:
- Dòng có `●` là tên đầy đủ của test, tức là quy tắc nào bị vỡ.
- `Expected` là giá trị bạn viết trong test; `Received` là giá trị code trả ra.
- `Received: 11` đúng bằng tổng cũ, 2 × 3 + 1 × 5. Quả lê vẫn được tính, khớp với báo cáo của khách. Một con số sai khác sẽ chỉ tới chỗ khác: 8 (3 + 5) nghĩa là hàm tính tổng bỏ qua số lượng.
- Assertion fail sẽ throw, nên Jest dừng test đó ngay tại đó; `toEqual` phía sau chưa chạy.

Lần chạy đỏ không phải thủ tục. Một test đã pass trên code hỏng thì không chứng minh gì về bản sửa của bạn: hoặc nó không chạm tới nhánh có bug, hoặc bug không nằm ở chỗ bạn nghĩ. Thấy nó fail đúng lý do bạn đoán mới làm cho lần xanh sau đó có ý nghĩa.

Cẩn thận với test pass vì lý do sai:
- Test không có `expect` sẽ pass miễn là không có gì throw. Gọi reducer mà không kiểm tra kết quả vẫn tăng coverage nhưng không bắt được gì.
- Assertion async thiếu `await`, ví dụ `expect(p).rejects.toThrow()`, để test kết thúc trước khi promise xong, nên nó pass. Đây là cái bẫy trong phần lỗi thường gặp của `testing-unit-core`. Với code phải throw bên trong `try`/`catch`, thêm `expect.assertions(1)`.
- Nếu test mới xanh ngay lần chạy đầu, hãy nghi nó rơi vào một trong các trường hợp trên trước khi kết luận code đúng.

## Sửa
Xử lý số lượng 0 và số âm đúng như quy tắc, và chuyển việc chặn ô trống về đúng chỗ: màn hình không dispatch khi ô còn trống.

```ts
    case 'setQty':
      if (action.qty <= 0) {
        return { items: state.items.filter((i) => i.id !== action.id) };
      }
      return {
        items: state.items.map((i) => (i.id === action.id ? { ...i, qty: action.qty } : i)),
      };
```

## Đo lại
Chạy lại đúng lệnh cũ:

```text
npx jest cartReducer -t "removes the line"
```

Cả hai test giờ đều pass. Sau đó chạy toàn bộ suite bằng `npx jest` (hoặc test script của project): bản sửa đổi logic dùng chung, nên mọi test khác có dựng giỏ hàng vẫn phải pass.

Nếu muốn, chạy `npx jest cartReducer --coverage` và xem cột `% Branch` và `Uncovered Line #s` của `cartReducer.ts`. Các dòng của nhánh `qty <= 0` không còn nằm trong `Uncovered Line #s`. Con số phần trăm trong project của bạn sẽ khác.

Coverage chỉ cho biết dòng code đã chạy, không cho biết có gì kiểm tra kết quả; một test không có assertion cũng đánh dấu nhánh đó là đã cover. Bằng chứng là test đã fail trước khi sửa và pass sau khi sửa.

Giữ test lại và commit cùng bản sửa. Khi CI chạy nó ở mọi pull request, ai đưa điều kiện chặn cũ quay lại sẽ nhận một build đỏ ghi rõ quy tắc bị vỡ.

## Nói trong phỏng vấn
"Tôi dựng lại lỗi bằng một unit test fail trước: đặt quả lê về 0 và mong tổng giảm từ 11 xuống 6. Test fail với `Expected: 6, Received: 11`, xác nhận dòng đó bị giữ lại và test của tôi chạm đúng bug. Nguyên nhân là điều kiện `!action.qty` coi 0 như ô bị bỏ trống. Tôi sửa `setQty` để xoá dòng khi `qty <= 0`, chuyển việc kiểm tra ô trống về màn hình, thấy test chuyển xanh rồi chạy toàn bộ suite. Test được giữ trong CI làm regression guard, và tôi đã kiểm tra rằng nó fail đúng lý do chứ không chỉ là nó pass."

## Liên quan
`testing-unit-core`, `state-redux-core`, `cart-checks`
