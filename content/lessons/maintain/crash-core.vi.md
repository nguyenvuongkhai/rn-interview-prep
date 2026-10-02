---
id: maintain-crash-core
topic: maintain/crash
kind: core
readMinutes: 6
---
## TL;DR
App RN hỏng ở ba tầng: JS, code native, và hệ điều hành kill process. Mỗi tầng cần symbol riêng mới đọc được (source map, dSYM, mapping của R8), và phải upload cho mọi bản build lẫn mọi bản OTA. Công cụ crash gom nhóm theo các frame của app trong stack, nên symbolicate kém thì gom nhóm cũng kém. Khi một bản release làm crash tăng vọt, hãy dừng rollout trước rồi mới điều tra.

## Cơ chế bên trong
### Ba loại sự cố
- Exception JS. Exception không được bắt sẽ tới global handler của `ErrorUtils`. Ở release build, handler mặc định coi nó là fatal và app dừng. Promise bị reject mà không bắt thì không crash; ở release nó biến mất nếu bạn không tự báo cáo. Error boundary chỉ bắt lỗi lúc render, không bắt lỗi trong event handler hay code bất đồng bộ.
- Crash native. Exception Java/Kotlin, exception Objective-C hay Swift, hoặc một signal như `SIGSEGV` trong code C++.
- Hệ điều hành kill app. Android báo ANR khi main thread không xử lý được input trong khoảng 5 giây; nguyên nhân thường gặp là I/O hoặc khởi tạo nặng trong `Application.onCreate`, và việc native chạy trên main thread. iOS kill app qua jetsam khi dùng quá nhiều bộ nhớ, và qua watchdog khi main thread treo, ví dụ lúc khởi động (mã exception `0x8badf00d`). Crash reporter chạy trong process không ghi được gì khi bị jetsam kill, nên hãy tìm trong Xcode Organizer, `MXAppExitMetric` của MetricKit hoặc log trên máy.

### Symbol
Hermes compile JS thành bytecode, nên stack ở release chỉ có offset bytecode như `index.android.bundle:1:948213`. Muốn đọc được, bạn cần source map đã ghép (Metro cộng Hermes compiler) của đúng bản build đó. Frame native iOS cần dSYM khớp UUID của binary. Frame Android bị R8 đổi tên cần `mapping.txt` của bản build đó. Hãy để CI upload cả ba ở mọi bản build, và upload source map mới cho mỗi bản OTA, vì mỗi bản update là một bundle mới. Upload map trước khi bản release tới người dùng: event được xử lý ngay lúc nhận.

### Gom nhóm
Sentry và Crashlytics tạo fingerprint chủ yếu từ các frame thuộc app, bỏ qua frame của framework, và chỉ dùng loại lỗi cùng message khi không có stack dùng được. Frame chưa symbolicate khác nhau giữa các bản build, nên một lỗi bị tách thành nhiều issue. Một helper chung như `handleError` nằm trên đỉnh mọi stack thì làm điều ngược lại: gộp các lỗi khác nhau vào một chỗ. Fingerprint tuỳ chỉnh, như `scope.setFingerprint` của Sentry, giải quyết cả hai.

### Chỉ số
Crash-free users là tỉ lệ người dùng không gặp crash nào trong khoảng thời gian đang xem; crash-free sessions là tỉ lệ phiên không kết thúc bằng crash. Lỗi đã bắt là non-fatal và không bị tính. Vài người crash mỗi lần mở app làm sessions giảm mạnh hơn users, nên hãy theo dõi cả hai theo từng version. Android vitals trên Play Console còn theo dõi tỉ lệ crash và ANR mà người dùng cảm nhận được so với ngưỡng "bad behaviour"; các ngưỡng này thay đổi theo thời gian, hãy tra tài liệu hiện hành.

## Góc phỏng vấn
- "Crash-free sessions giảm sau một bản release, bạn làm gì?" Dừng rollout, lọc theo version, kiểm tra symbolicate, chia theo máy và OS, giảm thiệt hại, rồi chạy post-mortem.
- "Người dùng nói app tự tắt nhưng không có crash report." Nghĩ tới việc hệ điều hành kill app: jetsam hay watchdog trên iOS, low memory killer trên Android.

## Lỗi thường gặp
- Upload source map cho binary nhưng quên các bản OTA
- Chỉ giữ mapping R8 của bản mới nhất
- Tắt upload mapping cho release build
- Đổ lỗi cho frame trên cùng thay vì frame đầu tiên của app
- Đọc ghi đĩa trên main thread lúc khởi động
- Cache không giới hạn, kết thúc bằng việc bị kill vì bộ nhớ mà không để lại report

## Liên quan
`maintain-upgrade-core`, `maintain-regression-core`, `release/ota-ci`, `native/build`
