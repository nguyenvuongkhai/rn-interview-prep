---
id: debug-native-core
topic: debug/native
kind: core
readMinutes: 6
---
## TL;DR
Bug dưới tầng JS thì React Native DevTools và Metro không thấy. Đọc log native bằng `adb logcat` hoặc Console.app và console của Xcode, đọc crash native từ exception gốc và frame đầu tiên của app trong thread bị crash, và bước qua code native bằng cách attach Android Studio hoặc Xcode. Bug chỉ có ở release hay trên một máy thì trước hết tái hiện bằng đúng bản build đó, trên đúng OS đó.

## Cơ chế bên trong
### Log Android và adb
- `adb logcat --pid=$(adb shell pidof -s com.shop.app)` giữ mọi dòng của process app: `console.*` của JS, log native và stack crash của `AndroidRuntime`. PID đổi khi app khởi động lại; `adb logcat -b crash` vẫn giữ crash gần nhất.
- Lọc theo tag hay mức độ chỉ thu hẹp theo tag hoặc mức, không theo app. Grep theo tên package bỏ sót phần lớn dòng.
- `adb reverse tcp:8081 tcp:8081` cho máy thật tới Metro qua `localhost:8081` khi kết nối adb còn. `adb -s <serial>` chọn một trong nhiều máy.
- `adb shell pm clear <package>` xoá dữ liệu app. `adb install -r` giữ dữ liệu; `adb install -g` tự cấp runtime permission và có thể che mất bug về quyền.

### Log iOS
`os_log` và `NSLog` đi vào hệ thống log hợp nhất, hiện trong console của Xcode khi chạy từ Xcode. Nếu không, mở Console.app, chọn thiết bị, bắt đầu stream trước khi tái hiện, rồi lọc theo process. Crash log cũ nằm trong cửa sổ thiết bị của Xcode hoặc phần dữ liệu phân tích trong Settings.

### Đọc crash native
- Java/Kotlin: đi theo chuỗi `Caused by:` tới khối cuối cùng. Exception ngoài cùng thường chỉ là lớp bọc của framework. `... N more` nghĩa là các frame còn lại trùng với trace bên ngoài; không mất gì.
- Signal: `SIGSEGV` (`EXC_BAD_ACCESS` trên iOS) là truy cập bộ nhớ không hợp lệ. `SIGABRT` là code tự gọi `abort()`; đọc `Abort message:` trước.
- Crash report iOS ghi thread gây crash ở `Triggered by Thread`; Thread 0 thường chỉ đang chờ trong run loop. Crash bên trong `objc_msgSend` thường là gửi message tới object đã bị giải phóng.
- Bắt đầu từ frame đầu tiên của code bạn trong thread bị crash. Việc symbolicate nằm ở `maintain-crash-core`.

### Debugger native
Mở `android/` trong Android Studio, đặt breakpoint rồi attach vào app debug đang chạy; code C++ cần debugger kiểu native hoặc dual. Trên iOS, mở `.xcworkspace`, chạy hoặc attach theo tên hay PID, rồi dùng LLDB (`bt`, `po`). Bản release Android không cho debug. Debugger JS chạy song song được, nhưng dừng lâu trên main thread làm UI đứng.

### Bug chỉ có ở release hoặc trên một máy
Cài đúng bản release (ví dụ `./gradlew installRelease`) và đọc logcat trước khi đoán. Lỗi do R8 có dạng `ClassNotFoundException` hoặc `NoSuchMethodError` trong code được gọi qua reflection hay JNI; giải mã bằng `retrace` rồi thêm keep rule hẹp. Quyền chỉ khai báo trong `src/debug` sẽ thiếu ở release; kiểm tra merged manifest. Với bug trên một phiên bản OS, tái hiện ở đó và tìm API được gọi mà không có `@available`.

## Góc phỏng vấn
- "Debug chạy, release crash khi mở." Cài release, `adb logcat -b crash`, retrace, xác nhận, sửa hẹp.
- "Crash chỉ trên một phiên bản iOS, Crashlytics không có gì." Lấy crash log từ máy, symbolicate, tái hiện trên OS đó.

## Lỗi thường gặp
- Tìm log native trong Metro hoặc React Native DevTools
- Lọc logcat theo tag hay tên package thay vì PID
- Dừng ở exception ngoài cùng thay vì khối `Caused by:` cuối cùng
- Đọc Thread 0 thay vì thread bị crash
- Nhầm `adb forward` với `adb reverse`
- Test bằng `adb install -g` nên không bao giờ thấy luồng xin quyền
- Đổ mọi lỗi chỉ có ở release cho R8

## Liên quan
`maintain-crash-core`, `native-build-core`, `native-modules-android-core`, `native-modules-ios-core`, `release-android-core`
