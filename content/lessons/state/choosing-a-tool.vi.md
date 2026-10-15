---
id: state-global-choosing-a-tool
topic: state/global
kind: core
readMinutes: 5
---
## TL;DR
Câu trả lời ở mức senior không dùng một công cụ cho mọi thứ. **Chia state theo loại**, rồi chọn công cụ phù hợp cho từng loại.

| Loại state | Ví dụ | Công cụ phù hợp |
| --- | --- | --- |
| Server state | Sản phẩm, hồ sơ, đơn hàng từ API | TanStack Query, RTK Query |
| Global client state | Giỏ hàng, phiên đăng nhập, cài đặt app | Redux Toolkit hoặc Zustand |
| Giá trị ít thay đổi | Theme, ngôn ngữ, người dùng hiện tại | Context API |
| State UI cục bộ | Ô nhập liệu, modal đang mở, tab đang chọn | `useState`, `useReducer` |

## Cơ chế bên trong
- **Redux Toolkit:** luồng dữ liệu một chiều, DevTools rất tốt, middleware, quy ước rõ ràng cho team lớn. Kết hợp với **Redux-Saga** cho luồng async phức tạp (huỷ, thử lại, chuỗi action). Nhiều cấu trúc hơn, nhiều code hơn.
- **Zustand:** API rất nhỏ, gần như không có boilerplate. Component đăng ký qua **selector**, nên chỉ re-render khi phần mình chọn thay đổi.
- **Context:** thực ra không phải công cụ quản lý state. Khi giá trị đổi, **mọi consumer đều re-render**, kể cả component chỉ đọc một field. Tách context hoặc memo giá trị có giúp, nhưng state hay thay đổi nên đặt ở chỗ khác.

## Góc phỏng vấn
- "Bạn thích cái nào hơn?" Trả lời theo loại state, rồi nêu công cụ cho từng loại.
- "Sao không dùng Context cho mọi thứ?" Vì mọi consumer re-render ở mỗi lần thay đổi.
- "Redux-Saga hay RTK Query?" RTK Query cho việc fetch và cache thông thường; saga cho luồng chạy lâu hoặc cần huỷ.

## Lỗi thường gặp
- Tự lưu dữ liệu API vào Redux rồi tự viết lại cache và cờ loading
- Một Context khổng lồ cho cả app
- Nghĩ rằng `React.memo` chặn được re-render do context

## Liên quan
`render/memo`
