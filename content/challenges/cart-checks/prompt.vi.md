## Đề bài
Lần này bạn viết test, không viết code. Viết `verifyCart(cartReducer, cartTotal)`. Hàm phải ném `Error` khi code giỏ hàng vi phạm bất kỳ quy tắc nào dưới đây, và chạy xong bình thường khi code đúng.

State của giỏ hàng là `{ items: { id, qty, price }[] }`. Các quy tắc:

- `add` với `{ id, price }` thêm item với `qty: 1`, hoặc tăng `qty` thêm 1 nếu id đã có.
- `remove` với một `id` xoá hẳn dòng đó.
- `setQty` với một `id` và một `qty` đặt lại số lượng; `qty` bằng 0 hoặc nhỏ hơn thì xoá dòng.
- Reducer không bao giờ sửa state được truyền vào; nó trả về state mới.
- `cartTotal(state)` là tổng `qty * price` của mọi dòng, và bằng 0 với giỏ rỗng.

Code của bạn chỉ có `console`, không có `expect`, nên hãy viết các kiểm tra nhỏ tự ném lỗi.

## Vì sao hay bị hỏi
Unit test chỉ tốt khi nó bắt được bug. Test ẩn truyền cho `verifyCart` của bạn một giỏ hàng đúng và vài giỏ hàng lỗi, mỗi giỏ có đúng một bug. Phần kiểm tra của bạn phải im lặng với bản đúng và ném lỗi với mọi bản lỗi. Đó cũng là cách nghĩ khi viết một test fail trước khi sửa và pass sau khi sửa.

## Ví dụ
```ts
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const one = cartReducer({ items: [] }, { type: 'add', item: { id: 'apple', price: 3 } });
assert(one.items.length === 1 && one.items[0].qty === 1, 'add puts a new item in with qty 1');
```

## Quy ước
- Không ném lỗi với giỏ hàng đúng.
- Mỗi giỏ hàng lỗi chỉ có một bug; mỗi quy tắc có một kiểm tra là đủ bắt.
- Dùng dữ liệu nhỏ của riêng bạn, ví dụ hai item có giá khác nhau.
