---
id: state-async-core
topic: state/async
kind: core
readMinutes: 6
---
## TL;DR
Phần lớn lỗi bất đồng bộ trong app RN không nằm ở code chậm mà ở thứ tự: một response về sau response mới hơn, một callback đọc giá trị của lần render cũ, một đợt retry đập vào server cùng lúc. Promise không huỷ được, và React không bỏ qua kết quả của lần chạy effect trước, nên chặn việc đã cũ là trách nhiệm của bạn. Với mỗi luồng bất đồng bộ, hãy quyết định kết quả nào được phép thắng.

## Cơ chế bên trong
### Task và microtask
Code đồng bộ chạy hết trước. Sau đó engine chạy hết hàng đợi microtask, gồm callback của promise và phần code sau mỗi `await`. Chỉ khi đó task kế tiếp mới chạy, ví dụ callback của `setTimeout`. Vì vậy `setTimeout(fn, 0)` không bao giờ chạy trước một `.then` đã resolve, và một chuỗi microtask dài có thể chặn timer cũng như việc xử lý sự kiện.

### Race trong effect
Mỗi lần effect chạy và gửi request là một promise độc lập. Nếu `query` đổi từ `re` sang `react` và response đầu chậm hơn, nó resolve sau cùng và ghi đè kết quả mới. Hãy chặn nó trong cleanup:

```ts
useEffect(() => {
  const controller = new AbortController();
  fetchResults(query, controller.signal)
    .then(setResults)
    .catch((e: Error) => {
      if (e.name !== 'AbortError') setError(e);
    });
  return () => controller.abort();
}, [query]);
```

`fetch` của RN tôn trọng `signal`; abort làm promise đang chờ reject với `AbortError`. Với promise không abort được, một cờ `ignore` cục bộ bật trong cleanup làm được việc tương tự. Abort chỉ làm app ngừng chờ: server có thể đã ghi dữ liệu rồi.

### Stale closure
Callback thấy giá trị của lần render đã tạo ra nó. Một interval tạo trong effect có deps `[]` sẽ đọc state của lần render đầu mãi mãi. Dùng updater dạng hàm cho state, ref cho giá trị chỉ cần đọc, hoặc `useEffectEvent` từ React 19.2.

### Các hàm gộp promise
- `Promise.all` reject ở lỗi đầu tiên và không dừng các promise còn lại.
- `Promise.allSettled` chờ mọi phần tử và báo kết quả từng cái, hợp với màn hình có các widget độc lập.
- `Promise.race` kết thúc theo promise xong đầu tiên; `Promise.any` resolve với promise thành công đầu tiên.
- `Promise.all` giữ kết quả theo thứ tự đầu vào, không giữ thứ tự thực thi. Việc cần chạy theo thứ tự phải dùng vòng `for...of` với `await`.

### Retry, chạy nền và việc dùng chung
Chỉ retry request idempotent, với exponential backoff, có giới hạn và jitter ngẫu nhiên, để các client lỗi cùng lúc không retry cùng lúc. Việc chỉ được làm một lần, như refresh token, nên dùng chung một promise đang chạy. Trên iOS, app vào nền thường bị suspend sau vài giây, nên việc bắt buộc phải xong cần giao cho cơ chế native chạy nền.

## Góc phỏng vấn
- "Danh sách search đôi khi hiện kết quả của query cũ." Giải thích latest-wins và cách chặn trong cleanup.
- "Người dùng bị đăng xuất ngẫu nhiên." Tìm chỗ nhiều request song song cùng tự refresh token.
- "Thiết kế nút like lạc quan chạy được khi offline." Outbox lưu xuống storage, gửi trạng thái mong muốn thay vì toggle, request idempotent, backoff có jitter, rollback khi gặp 4xx.

## Lỗi thường gặp
- Set state từ request mà không có cleanup chặn kết quả cũ
- Coi `AbortError` là lỗi thật và hiện màn hình lỗi
- Đọc state trong interval hay listener chỉ tạo một lần
- Dùng `forEach` với callback async cho việc cần đúng thứ tự
- Nghĩ rằng `Promise.all` huỷ các promise còn lại, hoặc chờ tất cả
- Retry không có jitter, hoặc retry thao tác ghi không idempotent
- Nhiều nơi cùng tự bắt đầu một lần refresh hay upload giống nhau

## Liên quan
`render-memo-core`, `render/effects`, `state/redux-saga`, `map-limit`
