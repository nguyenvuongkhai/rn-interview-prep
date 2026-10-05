---
id: performance-js-thread-core
topic: performance/js-thread
kind: core
readMinutes: 6
---
## TL;DR
React, các handler và animation do JS điều khiển dùng chung một JS thread, và JS chạy mỗi task tới khi xong, nên việc đồng bộ dài làm trễ tất cả. Hãy đưa việc theo từng frame ra khỏi JS, giảm tần suất event, và chia nhỏ hoặc chuyển việc nặng đi nơi khác. Đo trên release build.

## Cơ chế bên trong
### Các thread
- JS thread chạy render của React, effect, event handler và timer.
- Main thread (UI thread) vẽ view native, xử lý cuộn và nhận touch.
- Trên New Architecture (mặc định từ RN 0.76), Fabric có thể tính layout ngoài main thread, rồi mount kết quả trên main thread.

Perf Monitor trong dev menu hiện hai frame rate: UI và JS. JS thấp mà UI ổn nghĩa là JS là nút thắt: cuộn native vẫn chạy, nhưng tap và cập nhật do JS điều khiển bị trễ. UI thấp mà JS ổn nghĩa là việc native quá nặng, ví dụ ảnh quá lớn hoặc quá nhiều view.

### Ngân sách frame
Một frame kéo dài 1000 ms chia cho tần số quét: khoảng 16,6 ms ở 60 Hz và khoảng 8,3 ms ở 120 Hz. Một handler vừa đủ ở 60 Hz có thể làm trễ frame trên màn hình nhanh hơn.

### Thứ gì chặn JS
`JSON.parse` một chuỗi lớn, sort mảng lớn trong render, render hàng nghìn dòng một lúc, và render lại cả cây lớn sau mỗi phím gõ. Chờ không phải là chặn: trong lúc `await fetch(...)` hay lúc `<Image>` đang tải, việc đó chạy ở native.

### Đưa chuyển động ra khỏi JS
- `Animated` với `useNativeDriver: true` gửi animation sang native một lần, nên nó vẫn chạy khi JS bận; `Animated.event` nối được offset cuộn vào transform theo cùng cách. Native driver chỉ hỗ trợ thuộc tính không phải layout như `transform` và `opacity`; `height` hay `top` sẽ ném lỗi.
- Reanimated chạy worklet trên UI thread: shared value, `useAnimatedStyle`, `withSpring`. Khi dùng cùng react-native-gesture-handler, callback của cử chỉ cũng chạy ở đó. Chỉ quay về JS để báo kết quả cuối, bằng `runOnJS` (hoặc `scheduleOnRN` của `react-native-worklets` ở Reanimated 4).

### Tần suất event
Debounce chạy một lần sau khi chuỗi event dừng (tìm kiếm). Throttle giới hạn tần suất trong lúc chuỗi còn tiếp diễn (các kiểm tra theo cuộn). `scrollEventThrottle` là khoảng thời gian tối thiểu (ms) giữa hai event scroll gửi tới JS; hãy tăng nó khi bạn không cần độ chính xác.

### Nhường thread và chuyển việc đi
- Await một promise đã resolve chỉ xếp một microtask; hàng microtask được chạy hết trước khi tap hay frame được xử lý. Hãy nhường bằng một macrotask như `setTimeout(resolve, 0)`, và chia chunk theo ngân sách thời gian.
- `requestAnimationFrame` chạy JS trước frame kế tiếp; nó không làm việc rẻ đi.
- `InteractionManager.runAfterInteractions` hoãn việc tới khi các tương tác đang chạy kết thúc; hãy tra trạng thái của nó trong tài liệu của phiên bản RN bạn dùng.
- `startTransition` và `useDeferredValue` đánh dấu cập nhật tốn kém là không khẩn cấp, để ô nhập vẫn phản hồi nhanh. Chúng cần New Architecture, và vẫn chạy trên JS thread.
- Việc thật sự nặng thì chuyển sang native module hoặc thư viện JSI.

### Đo lường
Profile release build trên máy yếu: Hermes sampling profiler cho thấy thời gian JS đi đâu, React DevTools Profiler cho thấy component nào render và vì sao.

## Góc phỏng vấn
- "Gõ phím bị trễ trong một cuộc chat dài." Xem bộ đếm nào giảm, profile một phím gõ, giữ state ô nhập ở local, debounce các side effect.
- "Animation này giật mỗi khi dữ liệu tải về." Hỏi xem thứ gì đang điều khiển nó; chuyển sang native driver hoặc worklet.

## Lỗi thường gặp
- `useNativeDriver: false` cho header chạy theo cuộn
- Tạo hàm debounce ngay trong render
- Debounce một hiệu ứng phải bám theo ngón tay
- Dùng `await Promise.resolve()` để nhường thread
- Đưa state của chính ô nhập vào transition
- Đánh giá hiệu năng bằng dev build

## Liên quan
`maintain-regression-core`, `render-memo-core`, `state-async-core`, challenge `debounce`
