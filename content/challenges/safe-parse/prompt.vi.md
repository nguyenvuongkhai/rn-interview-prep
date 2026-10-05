## Đề bài
Viết một validator runtime nhỏ, `s`, theo kiểu zod. Nó có các builder sau:

- `s.string()`, `s.number()`, `s.boolean()`
- `s.literal(value)`: chỉ đúng giá trị đó
- `s.array(item)`: một mảng mà mọi phần tử đều khớp `item`
- `s.object(shape)`: một object mà các key khớp với schema trong `shape`

Mọi schema có `safeParse(value)`, trả về `{ success: true, data }` hoặc `{ success: false, issues }`, và `optional()`, trả về một schema chấp nhận thêm `undefined`. Mỗi issue là `{ path, message }`, trong đó `path` liệt kê các key và index từ gốc xuống tới giá trị sai.

## Vì sao hay bị hỏi
Kiểu của TypeScript bị xoá lúc build, nên `fetch<User>()` hay `route.params as Params` chỉ là một lời hứa với compiler. Backend đổi field hay một deep link gõ tay vẫn có thể đưa string vào chỗ code của bạn chờ number, và crash hiện ra ở nơi rất xa nguyên nhân. Interviewer muốn nghe bạn validate ở biên nào: response của API, deep link, state được persist và event từ native.

## Ví dụ
```ts
const User = s.object({ id: s.string(), age: s.number(), role: s.literal('admin').optional() });
User.safeParse({ id: 'u1', age: 30, extra: true });
// { success: true, data: { id: 'u1', age: 30 } }
User.safeParse({ id: 7, age: 'old' });
// { success: false, issues: [
//   { path: ['id'], message: 'Expected string' },
//   { path: ['age'], message: 'Expected number' } ] }
```

## Quy ước
- Các message là `Expected string`, `Expected number`, `Expected boolean`, `Expected array` và `Expected object`. Với literal, dùng `Expected ` nối với `JSON.stringify(value)`, ví dụ `Expected "admin"`.
- `NaN` không phải là number. `null` và mảng không phải là object.
- Báo mọi issue, không chỉ issue đầu tiên. Sắp theo thứ tự key trong shape và index của mảng, đi sâu trước.
- `object` bỏ các key không có trong shape. Key optional mà input không có thì `data` cũng không có.
- `data` là một giá trị mới. Không bao giờ sửa input.
