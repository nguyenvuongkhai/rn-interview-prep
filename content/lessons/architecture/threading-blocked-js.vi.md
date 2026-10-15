---
id: arch-threading-blocked-js
topic: architecture/threading
kind: core
readMinutes: 5
---
## TL;DR
Toàn bộ JavaScript của bạn chạy trên **một JS thread**. Khi nó bận (một `JSON.parse` lớn, map dữ liệu nặng, một lần render khổng lồ), thao tác chạm phải chờ và animation điều khiển bằng JS đứng hình. Những gì chạy trên **UI thread** vẫn tiếp tục.

## Cơ chế bên trong
| Luồng | Chạy những gì |
| --- | --- |
| JS thread | React render, cập nhật state, handler `onPress`, `JSON.parse`, timer |
| UI (main) thread | Vẽ native, nhận thao tác chạm, animation dùng native driver |
| Background thread | Layout (Yoga) và, với Fabric, chuẩn bị cây view mới |

- **Nút bấm phản hồi chậm:** native nhận được thao tác chạm, nhưng `onPress` phải chờ trong hàng đợi của JS.
- **Spinner đứng hình:** animation điều khiển bằng JS (`useNativeDriver: false`) cần JS cho từng frame. `ActivityIndicator` native vẫn quay.
- **Không phải lỗi bridge:** JSI bỏ được chi phí serialize, nhưng JavaScript của chính bạn vẫn chạy trên một luồng.

## Góc phỏng vấn
- "Xác nhận bằng cách nào?" Perf Monitor trên bản release: JS FPS tụt trong khi UI FPS giữ gần 60.
- "Sửa thế nào?" Theo thứ tự: giảm việc (phân trang phía server, chỉ lấy field cần), chia nhỏ hoặc hoãn phần còn lại (nhường event loop giữa các phần, `requestIdleCallback`, `startTransition`), render bằng danh sách virtualize, chuyển animation sang UI thread (`useNativeDriver: true`, Reanimated), và chuyển xử lý nặng vào native module hoặc một luồng nền.
- "Chia nhỏ `JSON.parse` được không?" Không. Hãy làm phản hồi nhỏ lại.

## Lỗi thường gặp
- Đổ lỗi cho bridge khi app đã dùng kiến trúc mới
- Spinner tự vẽ với `useNativeDriver: false`
- Map hàng nghìn item vào `ScrollView` ngay sau khi fetch

## Liên quan
`architecture/new-arch`, `performance/lists`
