## Đề bài
Viết `takeLatest(worker)`. Hàm trả về một object có:

- `run(arg)`: chạy `worker(arg, signal)` và trả về promise của một `RunResult`
- `cancel()`: huỷ lần chạy đang dở, nếu có

Chỉ lần chạy mới nhất được hoàn tất. Khi một `run` mới bắt đầu, lần trước bị huỷ: `AbortSignal` của nó bị abort và promise của nó resolve ngay thành `{ status: 'cancelled' }`, không đợi worker xong.

## Vì sao hay bị hỏi
Ô tìm kiếm gửi request ở mỗi lần gõ phím. Response về không theo thứ tự, và kết quả cho "re" về sau kết quả cho "react" rồi ghi đè lên nó. `takeLatest` của redux-saga, `AbortController` trong cleanup của `useEffect` và cách RTK Query xử lý request đều giải quyết race này. Interviewer muốn thấy bạn vừa huỷ request vừa bỏ qua câu trả lời đến muộn, vì không phải worker nào cũng tôn trọng signal.

## Ví dụ
```ts
const search = takeLatest((q: string, signal) => api.search(q, { signal }));
const first = search.run('re');
const second = search.run('react');
await first;  // { status: 'cancelled' }
await second; // { status: 'done', value: [...] }
```

## Quy ước
- Lần chạy mới nhất resolve thành `{ status: 'done', value }` khi worker resolve, và reject với lỗi của worker khi worker reject.
- Lần chạy đã bị huỷ không bao giờ reject, và giá trị hay lỗi đến muộn của nó bị bỏ qua.
- Gọi `cancel()` khi không có gì đang chạy thì không làm gì. `run` sau `cancel()` vẫn chạy bình thường.
- Gọi worker một cách đồng bộ ngay trong `run`.
