---
id: testing-e2e-core
topic: testing/e2e
kind: core
readMinutes: 5
---
## TL;DR
E2E test điều khiển một bản build thật trên simulator hoặc emulator giống như người dùng. Đây là tầng duy nhất chứng minh màn hình, navigation, native module và backend chạy được cùng nhau, và cũng là tầng chậm nhất, dễ flaky nhất. Chỉ giữ E2E cho vài luồng quan trọng, đẩy edge case xuống unit test và component test, và coi mỗi test flaky là một bug có nguyên nhân: timing, animation, network hoặc dữ liệu dùng chung.

## Cơ chế bên trong
### Detox: gray-box
Detox chạy test bằng Jest trên máy host và nói chuyện với một Detox client nằm trong process của app. Từ đó nó biết khi nào app bận: request chưa xong, animation, timer, việc trên JS thread. Nó chờ app rảnh trước mỗi action và assertion, nên hầu hết các bước không cần chờ thủ công. Mặt trái: thứ gì không bao giờ rảnh, như `Animated.loop`, một `setInterval` polling hay một request không bao giờ trả về, làm test treo tới timeout. Hãy dừng vòng lặp trong build E2E, loại URL bằng `device.setURLBlacklist`, hoặc tắt synchronisation ở bước đó và dùng `waitFor(...).toBeVisible().withTimeout(...)`.

### Maestro: black-box
Flow của Maestro là file YAML gồm các lệnh như `launchApp`, `tapOn`, `inputText` và `assertVisible`. Maestro CLI điều khiển app từ bên ngoài qua lớp UI automation của nền tảng, không thêm gì vào build của bạn. Nó không biết app có đang bận hay không, nên nó chịu đựng độ trễ: mỗi lệnh thử lại tới khi phần tử xuất hiện hoặc hết timeout. Flow viết nhanh và QA đọc được, nhưng bạn không truy cập được bên trong app.

### Kim tự tháp test
- Unit test với Jest: logic thuần như validation, reducer, formatter. Nhanh, nhiều, phủ mọi edge case.
- Component test với React Native Testing Library: một màn hình, mock native module và network. Phần lớn hành vi được test ở đây.
- E2E: vài luồng làm ra tiền hoặc làm mất người dùng, như đăng ký, đăng nhập, checkout, hay deep link mở đúng màn hình.

Chọn phần tử bằng `testID` chứ không bằng text hiển thị, để việc đổi câu chữ hay bản dịch không làm vỡ test.

### Flaky
- Timing: sleep cố định quá ngắn trên máy CI chậm và phí thời gian trên máy nhanh. Hãy chờ theo điều kiện.
- Animation làm Detox luôn thấy app bận, hoặc làm phần tử di chuyển đúng lúc đang tap.
- Network: dữ liệu staging dùng chung thay đổi mà bạn không biết. Dùng backend có seed sẵn hoặc mock server.
- Dữ liệu dùng chung: các test chung một tài khoản phá nhau khi chạy song song. Tạo dữ liệu riêng cho từng test và reset state lúc launch, ví dụ `device.launchApp({ newInstance: true, delete: true })` trong Detox hoặc `launchApp` với `clearState: true` trong Maestro.

### Trên CI
Android emulator chạy trên runner Linux có tăng tốc phần cứng; iOS simulator cần runner macOS đắt hơn. Build test binary một lần rồi dùng chung cho các shard. Chạy một bộ smoke ở mỗi PR và cả bộ vào ban đêm hoặc trước release. Lưu video, screenshot và log của test fail làm artifact.

## Góc phỏng vấn
- "Bộ E2E của chúng tôi flaky, bạn làm gì?" Đo tỉ lệ fail theo từng test, cách ly các test tệ nhất, sửa từng nguyên nhân, và theo dõi số lần retry thay vì giấu chúng.
- "Detox hay Maestro?" So sánh cách synchronise, ai viết test, ngôn ngữ, và chi phí của bản build test.
- "Thứ gì không nên là E2E test?" Edge case của logic, các biến thể giao diện, và màn hình native không thuộc về bạn, như payment sheet của hệ thống.

## Lỗi thường gặp
- Dùng sleep cố định thay vì chờ một phần tử
- Quên `await` trước `expect` của Detox, nên lỗi không bao giờ được báo
- Mặc định app sạch giữa các lần chạy mà không xoá state
- Một tài khoản test dùng chung cho nhiều worker chạy song song
- Chạy trên dữ liệu staging dùng chung
- Retry tới khi xanh mà không bao giờ sửa nguyên nhân

## Liên quan
`testing/unit`, `testing/components`, `release/ota-ci`, `maintain/regression`
