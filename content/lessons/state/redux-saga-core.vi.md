---
id: state-redux-saga-core
topic: state/redux-saga
kind: core
readMinutes: 6
---
## TL;DR
Saga là một generator yield ra effect: object thuần mô tả việc cần làm, và saga middleware là bên thực thi. Nhờ vậy saga test được từng bước và có cây task với cơ chế cancel thật. Cái giá là lỗi cũng đi lên theo cây đó: một lỗi không bắt trong một worker có thể làm dừng mọi saga trong app. Hiện nay, hãy nghĩ tới RTK Query hoặc listener middleware trước, và để dành saga cho workflow dài.

## Cơ chế bên trong
### Effect là dữ liệu
`yield call(api.fetchUser, id)` không gọi gì cả. `call` trả về một object có `type: 'CALL'` cùng hàm và tham số; middleware gọi hàm, chờ promise, rồi đưa kết quả trở lại qua `next()`. Test có thể chạy từng bước bằng `gen.next()` và so sánh từng effect, hoặc chạy saga với API đã mock bằng redux-saga-test-plan (`expectSaga`) hay `runSaga`.

### call, fork, spawn
- `call` block cho tới khi hàm hoặc generator return. Bọc nó trong `try/catch` để xử lý lỗi.
- `fork` tạo task attached và trả về ngay. Nếu một fork ném lỗi, task cha abort, effect đang chạy và các fork khác bị cancel, rồi lỗi ném ra khỏi task cha. `try/catch` quanh `yield fork(...)` không bắt được lỗi này.
- `spawn` tạo task detached: lỗi của nó ở lại với nó, và cancel task cha không ảnh hưởng tới nó.

### Helper
- `takeEvery` fork một worker cho mỗi action; các worker chạy song song và có thể xong sai thứ tự.
- `takeLatest` cancel worker trước khi có action mới. Hợp với ô tìm kiếm.
- `takeLeading` bỏ qua action mới trong lúc worker đang chạy. Hợp với nút Thanh toán.
- `actionChannel` buffer action để vòng lặp `take` rồi `call` xử lý từng cái một, đúng thứ tự.

### Cancel
`cancel(task)`, `takeLatest` và bên thua trong `race` đều cancel task. Effect hiện tại và các fork attached bị cancel, rồi generator return, nên chỉ `finally` chạy, không bao giờ là `catch`. Trong `finally`, `yield cancelled()` cho biết vì sao bạn tới đó. `fetch` vẫn chạy nếu bạn không abort: gọi `controller.abort()` trong `finally`, hoặc gắn method `[CANCEL]` (import từ `redux-saga`) vào promise.

### Channel
`eventChannel(subscribe, buffer?)` biến callback như NetInfo, AppState hay websocket thành thứ bạn `take` được. `subscribe` phải trả về hàm unsubscribe, hàm này chạy khi `chan.close()` hoặc `emit(END)`. Không có buffer thì event phát ra lúc saga đang bận sẽ mất. Cancel watcher không close channel; hãy gọi `chan.close()` trong `finally`.

### Combinator
`all` bắt đầu mọi effect cùng lúc; nếu một effect lỗi, các effect còn lại bị cancel và lỗi được ném ra. `race` lấy bên thắng đầu tiên và cancel các bên còn lại, đó là cách làm timeout với `delay`. `select` chỉ đọc state tại thời điểm đó, nên hãy đọc lại bên trong các vòng lặp dài.

## Góc phỏng vấn
- "Vì sao chọn saga thay vì thunk?" Effect khai báo, cancel lan theo cây task, `race`, channel. Sau đó nói luôn khi nào bạn không dùng saga.
- "Mọi saga ngừng chạy sau một lỗi mạng." Lỗi đã đi lên tới root. Dùng `try/catch` trong mọi worker, báo lỗi qua option `onError` của `createSagaMiddleware`, và cân nhắc `spawn` kèm restart có giới hạn cho các watcher ở root.

## Lỗi thường gặp
- Worker không có `try/catch` làm sập cả root saga
- Dùng `call` cho vòng lặp polling, nên không bao giờ tới `take` kế tiếp
- Dùng `takeEvery` cho tìm kiếm, nên response cũ thắng
- Tưởng `catch` chạy khi bị cancel, hoặc cancel sẽ abort `fetch`
- Quên `chan.close()`, làm rò listener native
- Giữ token lấy từ `select` bên ngoài một vòng lặp dài

## Liên quan
`state/async`, `state/redux`
