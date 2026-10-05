---
id: render-effects-core
topic: render/effects
kind: core
readMinutes: 6
---
## TL;DR
Effect đồng bộ một component với thứ nằm ngoài React: subscription, timer, native SDK, kết nối mạng. React chạy effect sau khi commit một lần render, và chạy cleanup trước lần chạy tiếp theo cũng như khi unmount. Nếu không có hệ thống bên ngoài nào, nhiều khả năng bạn không cần effect: tính giá trị ngay trong render, hoặc làm việc đó trong event handler đã gây ra nó.

## Cơ chế bên trong
### Thời điểm chạy
React render, commit kết quả xuống cây view native, rồi mới chạy effect. Trừ khi cập nhật đến từ một tương tác rời rạc như tap, frame thường được hiện trước. `useLayoutEffect` chạy đồng bộ sau commit và trước khi frame hiện. Từ RN 0.76, kiến trúc mới bật mặc định và layout được tính đồng bộ, nên bạn có thể đo một view trong `useLayoutEffect` rồi đặt vị trí tooltip mà không bị một frame sai. Cả hai hook đều chạy trên JS thread; chỉ khác thời điểm.

### Thứ tự cleanup
Khi một dep đổi, React render và commit với giá trị mới, chạy cleanup của lần trước với closure cũ, rồi mới chạy effect mới. Hai lần chạy của cùng một effect không bao giờ chồng lên nhau. Khi unmount, chỉ cleanup chạy.

```ts
useEffect(() => {
  const sub = Keyboard.addListener('keyboardDidShow', onShow);
  return () => sub.remove();
}, [onShow]);
```

Listener của `AppState`, `Keyboard`, `Dimensions` và `NativeEventEmitter` đều trả về một subscription có `remove()`. Hãy gỡ đúng subscription đó; `removeAllListeners` gỡ luôn listener của component khác.

### Deps
Mỗi dep được so sánh với giá trị trước đó bằng `Object.is`. Không có mảng deps thì effect chạy sau mọi lần commit. Với `[]`, nó chạy sau khi mount. Object và function tạo trong render là tham chiếu mới ở mỗi lần, nên hãy phụ thuộc vào primitive mà effect thật sự đọc, ví dụ `user.id`. Hằng số cấp module, ref và setter của `useState` đều ổn định, không cần liệt kê.

Effect set state có thể lặp vô hạn: nếu nó chạy lại sau mọi lần render và mỗi lần tạo ra một giá trị khác theo `Object.is`, React không bao giờ dừng. Set lại cùng một primitive thì React bỏ qua.

### Strict Mode
Từ React 18, khi dev Strict Mode chạy thêm một chu kỳ setup và cleanup lúc mount. Nó mô phỏng một lần remount thật. Nếu người dùng nhận ra được lần chạy thứ hai, cleanup đang thiếu. Hãy sửa cleanup thay vì chặn bằng ref.

### Effect Event
`useEffectEvent`, ổn định từ React 19.2, cho effect đọc props hoặc state mới nhất mà không cần đưa chúng vào deps. Chỉ gọi nó bên trong effect, không truyền cho component khác. Hãy kiểm tra bản RN của bạn đi kèm React nào: RN chỉ có React 19 từ 0.78.

## Góc phỏng vấn
- "Vì sao hàm effect không được là `async`?" Nó sẽ trả về Promise, trong khi React chờ một hàm cleanup hoặc không gì cả. Hãy gọi một hàm async bên trong effect và dùng cờ cancelled.
- "Vì sao effect vẫn chạy sau khi đã navigate đi?" Trong stack, màn hình trước vẫn mount. Dùng `useFocusEffect` của React Navigation cho việc cần dừng khi mất focus.
- "Khi nào effect là công cụ sai?" Giá trị dẫn xuất, reset state khi prop đổi (dùng `key`), và logic do một hành động cụ thể của người dùng gây ra.

## Lỗi thường gặp
- Truyền hàm `async` cho `useEffect`, làm mất cleanup
- Gỡ mọi listener của một sự kiện thay vì đúng subscription mình tạo
- Chép dữ liệu dẫn xuất vào state bằng effect, tốn thêm một lần render và một frame cũ
- Deps là object hay function tạo trong render, khiến effect chạy lại mỗi lần
- Giấu lần chạy đôi của Strict Mode bằng ref thay vì sửa cleanup
- Chạy việc gắn với màn hình trong `useEffect` khi màn hình vẫn mount trong stack

## Liên quan
`render/memo`, `state/async`, `architecture/new-arch`
