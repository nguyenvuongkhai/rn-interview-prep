---
id: architecture-new-arch-core
topic: architecture/new-arch
kind: core
readMinutes: 6
---
## TL;DR
New Architecture thay bridge cũ bằng JSI, một interface C++ cho JS gọi thẳng object native. Trên JSI có TurboModules (native module tạo lazy, có kiểu) và Fabric (renderer C++ với shadow tree bất biến). Từ RN 0.76, kiến trúc mới bật mặc định cùng Bridgeless mode, và lớp interop giữ cho nhiều thư viện cũ chạy tiếp. Gọi đồng bộ đã làm được nhưng nó chặn JS thread.

## Cơ chế bên trong
### Bridge cũ
Mọi lời gọi giữa JS và native được serialise thành JSON, xếp hàng và gửi qua bridge theo lô. Tất cả đều bất đồng bộ, dữ liệu lớn tốn chi phí serialise, và các module đăng ký qua package thường được khởi tạo khi bridge khởi động, dù có dùng hay không.

### JSI
JSI (JavaScript Interface) là một API C++ nằm giữa JS engine và code native. Code native đưa vào JS các host object và host function; JS giữ tham chiếu tới chúng và gọi trực tiếp, không gửi message, và gọi đồng bộ khi method được khai báo như vậy. JSI không phụ thuộc engine: Hermes là engine mặc định, nhưng JavaScriptCore cũng cài đặt JSI. Codegen là chuyện khác: nó sinh interface có kiểu từ spec lúc build.

### TurboModules
TurboModule được tạo ở lần đầu JS yêu cầu nó qua `TurboModuleRegistry`, rồi được dùng lại. Method có spec trả về Promise chạy bất đồng bộ; method trả về kiểu thường chạy đồng bộ trên JS thread và giữ thread đó tới khi native trả kết quả. Cách này hợp với giá trị nhỏ đã có sẵn trong bộ nhớ, không hợp với đọc đĩa, gọi mạng hay việc nặng.

### Fabric
Một update đi qua ba pha:
- Render: React chạy component, Fabric tạo hoặc clone shadow node C++.
- Commit: Yoga tính layout và cây mới được đưa lên làm cây kế tiếp.
- Mount: so cây cũ với cây mới rồi áp các mutation lên host view trên UI thread.

Render và commit thường chạy trên JS thread, vì shadow tree là C++ bất biến. Chỉ mount bắt buộc ở main thread. Vì layout được tính đồng bộ, `measureInWindow` trong `useLayoutEffect` trả về layout của lần commit này trước khi frame được vẽ, nên việc đặt vị trí theo kích thước đo được không còn nhấp nháy. Fabric cũng hỗ trợ concurrent root của React, nhờ đó transition và automatic batching chạy được trong RN.

### Bridgeless và interop
Ở Bridgeless mode không còn object bridge; trên Android, runtime do `ReactHost` quản lý thay cho `ReactInstanceManager`. JS vẫn chạy trên thread riêng của nó. Từ RN 0.74, lớp interop được bật tự động, nên nhiều module và view manager cũ vẫn chạy, nhưng code tự lấy bridge, gọi API nội bộ hay dựa vào timing layout cũ có thể vỡ. Từ 0.76 tới 0.81, bạn tắt tạm được bằng `newArchEnabled=false` trong `gradle.properties` và `RCT_NEW_ARCH_ENABLED=0` khi `pod install`; theo release notes của 0.82, từ bản đó kiến trúc cũ không bật lại được nữa.

## Góc phỏng vấn
- "Có gì thay đổi so với bridge, và vì sao nó quan trọng?" Đi lần lượt bridge, JSI, TurboModules và Fabric, rồi nêu lợi ích: khởi động, layout đồng bộ, concurrent React, kiểm tra kiểu lúc build.
- "JSI cho gọi đồng bộ, vậy có nên dùng ở mọi chỗ?" Không: gọi đồng bộ chặn JS thread. Giữ bất đồng bộ làm mặc định và đo mọi method đồng bộ trên máy yếu.

## Lỗi thường gặp
- Nghĩ rằng JSI hay New Architecture bắt buộc phải dùng Hermes
- Đổi việc đọc đĩa hay gọi mạng thành đồng bộ rồi gọi trong handler scroll
- Đo trong `useEffect` thay vì `useLayoutEffect` và bị nhấp nháy một frame
- Thêm `newArchEnabled=false` trong khi dòng `newArchEnabled=true` của template vẫn còn ở phía dưới file
- Cho rằng lớp interop chạy được mọi thư viện cũ mà không kiểm thử từng màn hình

## Liên quan
`maintain-upgrade-core`, `native-modules-ios-core`, `native-modules-android-core`, `performance-js-thread-core`
