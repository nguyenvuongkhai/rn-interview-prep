---
id: typescript-generics-core
topic: typescript/generics
kind: core
readMinutes: 6
---
## TL;DR
Generic giữ quan hệ giữa đầu vào và đầu ra: `first<T>(items: T[]): T | undefined` trả về `number | undefined` với một `number[]`, còn bản `any` trả về `any` và tắt luôn việc kiểm tra. Generic và utility type chỉ tồn tại lúc biên dịch. Chúng không bao giờ validate dữ liệu lúc chạy, và phần lớn lỗi đến từ việc quên điều đó hoặc kỳ vọng utility type làm nhiều hơn thực tế.

## Cơ chế bên trong
### Suy luận và nới kiểu
Khi `T` được suy ra từ một literal như `'idle'`, nó bị nới thành `string` nếu `T` không có constraint primitive và không đứng trực tiếp ở kiểu trả về. Muốn giữ literal thì dùng `T extends string` hoặc `const` type parameter (TS 5.0+): `function routes<const T extends readonly string[]>(r: T): T` suy ra `readonly ['home', 'profile']` cho `routes(['home', 'profile'])`. `NoInfer<T>` (TS 5.4) loại một tham số khỏi quá trình suy luận. Giá trị mặc định hoạt động như tham số mặc định của hàm: với `type ApiResponse<T = unknown>`, `ApiResponse` nghĩa là `ApiResponse<unknown>`.

### Constraint, keyof và indexed access
`K extends keyof T` cùng kiểu trả về `T[K]` cho bạn các helper `getField`, `pick` hay `groupBy` có kiểu chính xác; trả về `T[keyof T]` là bỏ mất `K`, và mọi lời gọi nhận union của mọi giá trị. Tham số kiểu chỉ dùng một lần thì không nối gì cả.

### Utility type có sẵn
`Partial`, `Required` và `Readonly` là mapped type và chỉ tác động ở cấp một: `Readonly<Settings>` vẫn cho ghi `s.flags.beta`. `Pick` đòi key phải có thật, nhưng `Omit` nhận mọi `PropertyKey`, nên gõ sai cũng im lặng. `Omit` cũng không phân phối: trên union nó chỉ giữ key chung và mất discriminant. `Record<K, V>` với union literal thì mọi key đều bắt buộc. `Exclude` và `Extract` lọc union, `NonNullable` bỏ `null` và `undefined`, `Parameters` và `ReturnType` đọc kiểu của hàm, `Awaited` (TS 4.5+) mở Promise.

### Mapped type, template literal type và conditional type
Key remapping kết hợp template literal type biến một event map thành các prop handler:

```ts
type Handlers<E> = {
  [K in keyof E as `on${Capitalize<K & string>}`]?: (payload: E[K]) => void;
};
```

Conditional type với tham số kiểu trần, `T extends U ? X : Y`, sẽ phân phối qua union: `ListOf<'a' | 'b'>` thành `'a'[] | 'b'[]`. Bọc cả hai vế, `[T] extends [U]`, để tắt việc này. `infer` trích một phần của kiểu, và `ReturnType` được xây theo cách đó.

### Component generic và API client
Trong `.tsx`, viết `<T,>` cho arrow function để parser không hiểu nhầm là thẻ JSX. JSX suy ra `T` từ props, nên `<List data={users} renderItem={(u) => u.name} />` cho `u` kiểu `User`. `React.memo` làm mất generic; cast kết quả về `typeof List`. Một hàm `get<T>(url)` kết thúc bằng `res.json() as T` là cast không kiểm tra: hãy validate ở ranh giới bằng schema như zod và suy kiểu từ schema đó.

## Góc phỏng vấn
- "Vì sao dùng generic mà không dùng `any`?" Nói về việc nối đầu vào với đầu ra, và JS sinh ra là như nhau.
- "Viết một hàm `pick` có kiểu." Dùng `K extends keyof T` và `Pick<T, K>`, rồi giải thích vì sao `Omit` không kiểm tra key.
- "API client của bạn có type-safe không?" Trả lời là không, trừ khi response được validate; generic là một lời hứa, không phải phép kiểm tra.

## Lỗi thường gặp
- Tưởng `Readonly`, `Partial` hay `Required` tác động mọi cấp
- Dùng `Omit` trên union và mất khả năng narrow
- Trả về `T[keyof T]` thay vì `T[K]`
- Conditional type phân phối khi bạn không muốn
- Coi `as T` trong helper fetch là validate
- Bọc component generic bằng `React.memo` rồi mất `T`
- Kiểu viết quá phức tạp, không ai trong team đọc hay debug được

## Liên quan
`typescript-types-core`, `typescript-react-core`, `state-redux-core`
