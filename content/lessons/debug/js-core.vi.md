---
id: debug-js-core
topic: debug/js
kind: core
readMinutes: 6
---
## TL;DR
Từ RN 0.76, React Native DevTools là debugger JS mặc định: breakpoint, chạy từng bước, call stack, scope và console, nối thẳng vào Hermes trên thiết bị. React DevTools bên trong nó cho xem props, state, hooks và lý do component render. Debugger chỉ chạy trên dev build, nên lỗi chỉ có ở release cần log, source map và một bản release mà bạn dựng lại lỗi được. Khi nguyên nhân chưa rõ, hãy thu nhỏ vấn đề: tạo bản tái hiện tối thiểu, rồi bisect.

## Cơ chế bên trong
### Debugger
- React Native DevTools mở từ dev menu, hoặc bấm `j` trong terminal đang chạy Metro. Nó nối vào engine JS trên thiết bị hay simulator, nên thứ bạn debug là thứ người dùng chạy. Các panel có sẵn có thể khác nhau giữa các phiên bản RN, nên hãy xem tài liệu của phiên bản bạn dùng.
- Đặt breakpoint ở bất kỳ dòng nào trong panel Sources; source map hiện lại file gốc của bạn. Breakpoint có điều kiện như `item.price === undefined` bỏ qua các lần chạy bình thường.
- `debugger;` là breakpoint cứng khi có debugger gắn vào, và là lệnh rỗng khi không có. Tiện cho code chạy lúc khởi động, nhưng dễ bị quên, nên hãy để lint chặn.
- Khi đang dừng, cả JS thread đứng lại: timer, callback mạng và cập nhật do JS điều khiển đều phải chờ. Chính việc dừng có thể che mất một lỗi về timing.
- Console giữ tham chiếu chứ không chụp lại giá trị. Mở rộng một object đã log sẽ hiện trạng thái hiện tại, nên hãy log `JSON.stringify(value)` khi cần giá trị tại thời điểm đó.

### Cách cũ
"Debug JS Remotely" kiểu cũ chạy JS trong V8 của Chrome trên máy tính và nói chuyện với native qua websocket. Lỗi có thể biến mất khi debug vì code đang chạy trên một engine khác. Cách này đã bị deprecate và không chạy với chế độ bridgeless của kiến trúc mới. Flipper đã bị bỏ khỏi template từ RN 0.74.

### React DevTools
Panel Components hiện props, state và hooks hiện tại của component đang chọn, giúp bạn tìm giá trị sai bắt đầu từ đâu trong cây. Profiler ghi lại các commit; khi bật cài đặt ghi lý do render của mỗi component, nó cho biết props hay hook nào đã đổi.

### Red box và LogBox
Ở dev, lỗi không được bắt hiện red box; cảnh báo và lỗi được log hiện trong LogBox. Ở release không có red box, nhưng exception vẫn bị ném. Khi đọc stack, hãy tìm frame đầu tiên thuộc code của bạn; các frame trên cùng thường là thư viện đang báo đầu vào sai.

### Lỗi chỉ có ở release
- Dựng lại trên release build chạy trên máy thật, và đọc log của thiết bị trong lúc đó.
- Symbolicate stack bằng source map của đúng bản build đó.
- Liệt kê khác biệt với dev: nhánh `__DEV__`, tên bị minify đổi (đừng rẽ nhánh theo `constructor.name`), cấu hình, lời gọi `console` bị loại bỏ.
- Log theo cấu trúc: tên event, request id dùng chung với backend, và lỗi được chuẩn hoá thành `name`, `message`, `stack`. `JSON.stringify` một `Error` cho ra `{}`.

### Thu nhỏ vấn đề
Dựng bản tái hiện tối thiểu trong một project mới với cùng phiên bản, rồi bỏ code theo từng nửa cho tới khi lỗi biến mất. Để tìm lỗi bắt đầu từ đâu, chạy `git bisect` giữa một commit tốt và một commit lỗi, hoặc `git bisect run` với một script khi có test kiểm tra được.

## Góc phỏng vấn
- "Lỗi chỉ xảy ra ở release. Bạn debug thế nào?" Dựng lại trên release, đọc log, dùng source map, so khác biệt giữa dev và release, tạo bản tái hiện tối thiểu.
- "Vì sao lỗi biến mất khi bật debugger?" Engine khác (remote debugging kiểu cũ) hoặc timing thay đổi do dừng ở breakpoint.

## Lỗi thường gặp
- Dùng remote debugging qua Chrome hay Flipper cho project hiện đại
- Mong gắn được debugger vào release build
- Tin object mở rộng trong console là bản chụp tại lúc log
- Log nguyên object `Error` bằng `JSON.stringify`
- Rẽ nhánh theo tên class hay tên hàm mà minifier đổi đi
- Đổ lỗi cho frame trên cùng thay vì frame đầu tiên của app

## Liên quan
`maintain-crash-core`, `maintain-regression-core`, `workflow-git-agile-core`, `performance-js-thread-core`
