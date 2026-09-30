---
id: render-memo-pitfalls
topic: render/memo
kind: pitfall
readMinutes: 4
---
## TL;DR
`React.memo` chỉ bỏ qua một lần render khi mọi prop đều bằng nhau theo `Object.is`. Phần lớn lỗi memo đến từ hai sai lầm: vô tình phá phép so sánh đó bằng một tham chiếu mới, hoặc giữ nguyên tham chiếu trong khi nội dung lẽ ra phải đổi.

## Cơ chế bên trong
Khi component cha render, React so sánh nông (shallow) từng prop của component đã bọc memo. Chỉ cần một prop là tham chiếu mới, component con sẽ render lại. Chiều ngược lại cũng đúng: nếu một prop giữ nguyên tham chiếu trong khi nội dung thay đổi, component con bỏ qua lần render mà nó cần. `useCallback` và `useMemo` giữ ổn định tham chiếu, nhưng tự chúng không ngăn được render. Cập nhật context đến được mọi component đọc nó bằng `useContext`, dù có memo hay không.

## Góc phỏng vấn
- "useCallback có ngăn re-render không?" Không. Nó chỉ có ích khi một component con đã memo hoặc một mảng deps so sánh hàm đó.
- "Khi nào không nên dùng memo?" Khi prop gần như luôn thay đổi, hoặc component quá rẻ để render. Lúc đó chi phí so sánh còn lớn hơn phần tiết kiệm được.
- "Một row đã memo vẫn re-render. Bạn xem gì trước?" Xem lý do render trong Profiler, rồi tìm prop nào nhận tham chiếu mới và nó được tạo ở đâu.

## Lỗi thường gặp
- Truyền arrow function inline cho row đã memo trong `renderItem`
- Truyền cả state `selected` thay vì một boolean `isSelected`
- Tạo `data` bằng `map` kèm spread ở mỗi lần render, khiến mọi item có tham chiếu mới
- Bỏ một giá trị khỏi deps để giữ callback ổn định, khiến callback đọc state cũ
- Sửa trực tiếp một item: tham chiếu không đổi, nên row đã memo bỏ qua cập nhật
- Viết `value={{ user, signOut }}` inline trên provider, khiến mọi consumer re-render mỗi khi provider render
- Quên rằng context đổi thì component vẫn re-render, dù đã bọc memo

## Liên quan
`render-memo-core`, `performance/lists`
