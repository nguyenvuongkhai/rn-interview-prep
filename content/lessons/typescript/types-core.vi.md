---
id: typescript-types-core
topic: typescript/types
kind: core
readMinutes: 6
---
## TL;DR
TypeScript kiểm tra hình dạng của giá trị trong code của bạn, rồi biến mất: kiểu bị xoá trước khi bundle chạy. Phần lớn lỗi kiểu thực tế đến từ những chỗ compiler tin bạn thay vì kiểm tra: `as`, `!`, `any`, type guard viết sai logic, và dữ liệu từ bên ngoài. Hãy mô hình trạng thái bằng discriminated union, narrow trước khi dùng, và validate lúc chạy ở mọi chỗ dữ liệu đi vào app.

## Cơ chế bên trong
### Structural typing và excess property check
Kiểu được so sánh theo cấu trúc, không theo tên, nên property thừa vẫn hợp lệ. Ngoại lệ duy nhất là object literal mới gán thẳng vào một kiểu: nó có thêm excess property check (`Object literal may only specify known properties`). Đi qua một biến trung gian thì lỗi gõ nhầm `colour` lọt qua.

### any, unknown và narrowing
`any` tắt kiểm tra; `unknown` nhận mọi giá trị nhưng không cho làm gì cho tới khi bạn narrow. `res.json()` và `JSON.parse` trả về `any`; hãy gán chúng vào `unknown`. Từ TypeScript 4.4, `strict` bật `useUnknownInCatchVariables`, nên `catch (e)` cho `unknown` và bạn narrow bằng `e instanceof Error`. Narrow bằng `typeof`, `instanceof`, `'key' in value`, so sánh bằng, hoặc truthiness, mà truthiness thì loại luôn `0` và `''`, nên hãy kiểm tra `=== null` khi các giá trị đó hợp lệ. Type guard tự viết `value is T` được tin chứ không được kiểm tra: guard trả về `true` quá rộng sẽ nói dối compiler.

### Discriminated union và never
Các cờ như `isLoading` và `isError` cho phép những tổ hợp không thể có. Union `{ status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: string }` chỉ cho đọc `data` sau khi kiểm tra `status`. Trong `switch`, gọi `assertNever(state)` ở `default`, với `assertNever(x: never)` luôn throw: member mới chưa được xử lý sẽ thành lỗi compile. Viết `state as never` tắt đúng lỗi đó.

### Assertion, satisfies và literal
`as` không được kiểm tra; nó chỉ báo lỗi khi hai kiểu hoàn toàn không giao nhau, và `x as unknown as T` vượt qua cả điều đó. Annotation thay kiểu suy ra bằng kiểu khai báo. `satisfies` (TypeScript 4.9 trở lên) kiểm tra giá trị theo một kiểu nhưng giữ kiểu suy ra hẹp hơn, nên config kiểm tra theo `Record<string, string>` vẫn biết từng key. `as const` giữ kiểu literal readonly như `'/'`.

### interface, type và enum
Các khai báo `interface` cùng tên sẽ merge, đó là cách augment kiểu của thư viện; `type` alias không khai báo lại được, và chỉ `type` biểu diễn được union. `interface extends` báo property không tương thích ngay chỗ khai báo, còn `&` lặng lẽ tạo ra `never`. `enum` thường sinh object lúc chạy, và string enum là nominal, nên `'dark'` không phải là `Theme`; numeric enum thì vẫn nhận mọi `number`. Union string literal bị xoá hoàn toàn và không cần import.

### Các flag strict
`strict` bao gồm `strictNullChecks` và `noImplicitAny`. Không nằm trong `strict`: `noUncheckedIndexedAccess` làm `arr[i]` và `record[key]` có thể là `undefined`, và `exactOptionalPropertyTypes` khiến `prop?: string` không nhận `undefined` gán tường minh. `?.` xử lý giá trị bị thiếu; `!` chỉ xoá `undefined` khỏi kiểu.

## Góc phỏng vấn
- "Vì sao một màn hình type chặt vẫn crash vì dữ liệu API?" Kiểu bị xoá lúc chạy; validate ở ranh giới bằng zod và suy ra kiểu bằng `z.infer`.
- "Bạn mô hình trạng thái request thế nào?" Discriminated union cộng với `switch` exhaustive.
- "`any` hay `unknown`? `satisfies` hay `as`?" Chọn cái mà compiler thật sự kiểm tra.

## Lỗi thường gặp
- Ép kiểu response API bằng `as` thay vì validate
- Type guard chỉ kiểm tra `typeof value === 'object'`
- Narrowing bằng truthiness coi `0` hoặc `''` là thiếu dữ liệu
- `as never` hoặc `!` tắt đúng kiểm tra bạn đang dựa vào
- Dùng cờ boolean thay vì discriminated union
- Tưởng excess property check chạy ở mọi phép gán

## Liên quan
`typescript-generics-core`, `typescript-react-core`, `state-async-core`
