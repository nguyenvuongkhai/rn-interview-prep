---
id: render-memo-core
topic: render/memo
kind: core
readMinutes: 6
---
## TL;DR
Một component re-render khi state của chính nó đổi, khi context mà nó đọc đổi, hoặc khi component cha render. `React.memo`, `useMemo` và `useCallback` tự chúng không chặn render. Chúng giữ ổn định tham chiếu để một phép so sánh `Object.is` sau đó có thể thành công. Memoization là gợi ý hiệu năng, không phải cam kết, và chỉ có lợi khi có thứ thật sự so sánh các tham chiếu đó.

## Cơ chế bên trong
### React.memo
Khi component cha render, React so sánh từng prop của component đã memo với giá trị trước đó bằng `Object.is`. Nếu mọi prop đều bằng nhau, React có thể dùng lại kết quả lần trước. Tham số thứ hai, `arePropsEqual(prev, next)`, thay cho phép so sánh đó và trả `true` khi prop được xem là bằng nhau. Hàm này chỉ chạy ở các lần render lại do cha, không bao giờ chạy lúc mount, và không nhìn thấy state hay context: state của chính component, hoặc context mà nó đọc, thay đổi thì nó vẫn re-render.

### useMemo và useCallback
`useMemo(fn, deps)` lưu kết quả và deps của lần gần nhất. Ở lần render sau, React so sánh từng dep bằng `Object.is`. Nếu tất cả khớp, nó trả về kết quả đã lưu; nếu không, nó gọi lại `fn`. Nó chỉ giữ một bản gần nhất, không giữ lịch sử. `useCallback(fn, deps)` cùng cơ chế, chỉ khác là giá trị được lưu chính là hàm.

```ts
const visible = useMemo(() => filterMessages(messages, query), [messages, query]);
const onSelect = useCallback((id: string) => setSelectedId(id), []);
```

React có thể bỏ cache, ví dụ khi component suspend trong lần mount đầu, và Strict Mode gọi hàm tính hai lần khi dev. Code của bạn phải vẫn đúng khi giá trị bị tính lại, nên hãy giữ hàm thuần và không bao giờ đặt side effect trong đó.

### Mọi thứ xoay quanh tham chiếu
Object literal, array literal, function inline hay JSX element tạo ra trong lúc render đều là tham chiếu mới ở mỗi lần. Điều này áp dụng cả cho `children`. Khi cha render `<Card><Text>Hi</Text></Card>`, element `Text` là element mới, nên `React.memo(Card)` không bao giờ bỏ qua được, trừ khi element đó cũng được memo.

Context provider cũng theo đúng quy tắc này. Nếu value là `{ user, signOut }` viết inline, mọi consumer re-render mỗi khi provider render. Hãy memo value, hoặc tách thành các context thay đổi với tần suất khác nhau.

### React Compiler
React Compiler là một Babel plugin chạy lúc build. Nó phân tích các component và hook tuân theo Rules of React rồi tự thêm memoization cho giá trị, callback và JSX. Nó bỏ qua những chỗ phát hiện vi phạm, nhưng không phát hiện được mọi vi phạm, nên hãy giữ bật các rule lint của React Hooks. Các lời gọi `useMemo` và `useCallback` có sẵn vẫn chạy bình thường, nên bạn không cần xoá chúng trước khi bật compiler.

## Góc phỏng vấn
- "`useCallback` có ngăn re-render không?" Không. Nó giữ ổn định tham chiếu của hàm, và điều đó chỉ có ích khi một component con đã memo hoặc một mảng deps so sánh hàm đó.
- "Khi nào `useMemo` đáng dùng?" Khi phép tính tốn kém đo được, hoặc khi tham chiếu của kết quả đi vào `React.memo` hay deps của hook khác.
- "React Compiler thay đổi điều gì?" Code mới hiếm khi cần memo thủ công, nhưng bạn vẫn phải tuân theo Rules of React và vẫn phải profile. Compiler không làm phép tính rẻ hơn khi input thật sự thay đổi.

## Lỗi thường gặp
- Bọc component bằng `React.memo` nhưng vẫn truyền object, callback hoặc `children` inline
- Bỏ một giá trị khỏi deps để giữ callback ổn định, khiến nó đọc state cũ
- Viết `arePropsEqual` bỏ qua prop callback, gây ra đúng loại stale closure đó
- Sửa trực tiếp một object: tham chiếu không đổi, nên component con đã memo bỏ qua cập nhật
- Nghĩ rằng `React.memo` che chắn component khỏi thay đổi của context

## Liên quan
`render-memo-pitfalls`, `render/effects`, `performance/lists`
