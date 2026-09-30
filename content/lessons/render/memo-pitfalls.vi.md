---
id: render-memo-pitfalls
topic: render/memo
kind: pitfall
readMinutes: 6
---
## TL;DR
`React.memo` chỉ bỏ qua một lần render khi **mọi prop đều bằng nhau theo `Object.is`**. Hàm hoặc object được tạo mới trong lúc render sẽ làm memo mất tác dụng.

## Cơ chế bên trong
Khi component cha render, React so sánh nông (shallow) từng prop của component đã bọc memo. Chỉ cần một prop là tham chiếu mới, component con sẽ render lại. `useCallback` và `useMemo` giữ ổn định tham chiếu, nhưng chúng tự nó không ngăn được render.

## Góc phỏng vấn
- "useCallback có ngăn re-render không?" Không. Nó chỉ có ích khi kết hợp với một component con đã bọc memo.
- "Khi nào *không nên* dùng memo?" Khi prop gần như luôn thay đổi, hoặc component quá rẻ để render. Lúc đó chi phí so sánh còn lớn hơn phần tiết kiệm được.

## Lỗi thường gặp
- Truyền arrow function inline trong `renderItem`
- Truyền cả state `selected` thay vì một boolean `isSelected`
- Quên rằng context đổi thì component vẫn re-render, dù đã bọc memo

## Liên quan
`performance/lists`
