## Đề bài
Viết `createEmitter<Events>()`, nửa phía JS của một native event bridge. `Events` ánh xạ tên event sang kiểu payload, ví dụ `{ progress: number; done: { path: string } }`.

Object trả về có:

- `on(event, fn)`: thêm listener và trả về hàm unsubscribe
- `once(event, fn)`: giống `on`, nhưng listener bị gỡ trước lần gọi đầu tiên
- `emit(event, payload)`: gọi các listener của event đó theo đúng thứ tự đăng ký
- `listenerCount(event)`: số listener còn đang đăng ký

## Vì sao hay bị hỏi
Native module đẩy event progress hay pin vào JS, trong khi các màn hình subscribe và unsubscribe ngay lúc event đang chạy. `NativeEventEmitter` báo mỗi lần subscribe và unsubscribe cho native module, và `RCTEventEmitter` đếm chúng để code native biết khi nào bật, tắt nguồn event. Interviewer luôn hỏi tiếp về edge case: listener tự unsubscribe, màn hình subscribe từ bên trong một handler, handler ném lỗi.

## Ví dụ
```ts
const events = createEmitter<{ progress: number }>();
const off = events.on('progress', (p) => console.log(p));
events.emit('progress', 0.5); // in ra 0.5
off();
events.listenerCount('progress'); // 0
```

## Quy ước
- Listener thêm vào trong lúc `emit` không chạy ở lần `emit` đó, chỉ chạy ở các lần sau.
- Listener bị gỡ trong lúc `emit` sẽ không chạy nếu chưa tới lượt. Gỡ bất kỳ listener nào, kể cả listener đang chạy, không được làm bỏ sót các listener khác.
- Gọi hàm unsubscribe hai lần thì không làm gì.
- Nếu có listener ném lỗi, các listener còn lại vẫn chạy. Sau khi tất cả đã chạy, `emit` ném lại lỗi đầu tiên.
- Đăng ký cùng một hàm hai lần thì có hai listener.
