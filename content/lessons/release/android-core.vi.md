---
id: release-android-core
topic: release/android
kind: core
readMinutes: 6
---
## TL;DR
Google Play tách key bạn dùng để upload khỏi key người dùng thấy, tạo APK cho từng máy từ AAB của bạn, và cho phát hành theo track và theo phần trăm. Không có gì trên Play đưa người dùng về bản cũ: bạn halt rồi ra bản có `versionCode` cao hơn. Chính sách đổi hằng năm, nên hãy xem trang Policy status trong Play Console trước mỗi lần release.

## Cơ chế bên trong
### Signing
Với Play App Signing, Google giữ app signing key, còn bạn ký mỗi bản upload bằng upload key. Play kiểm tra bản upload rồi ký các APK nó tạo ra bằng app signing key, nên người dùng luôn thấy cùng một chữ ký. Mất upload key thì chủ tài khoản yêu cầu reset trên trang App integrity, nhưng việc này không có hiệu lực ngay. Mất signing key của một app không dùng Play App Signing thì app đó không bao giờ cập nhật được nữa. Các dịch vụ như Google Sign-In cần fingerprint của app signing key, không phải của upload key.

### Bundle và version
AAB là định dạng để publish, không phải file cài được. Play tách nó theo ABI, mật độ màn hình và ngôn ngữ thành APK cho từng máy. Muốn thử ở máy, dùng `bundletool` hoặc đưa lên internal testing. `versionCode` là số nguyên phải mới cho mỗi lần upload và cao hơn cho mỗi bản cập nhật; `versionName` chỉ để hiển thị. Build type `release` của template RN dùng signing config debug cho tới khi bạn đổi.

### Track và rollout
Hãy promote một release qua internal, closed, open testing rồi lên production thay vì build lại. Production có thể staged rollout theo phần trăm người dùng. Halt sẽ ngừng phát release cho người mới, nhưng máy đã cập nhật thì vẫn giữ. Tài khoản developer cá nhân mới (tạo sau tháng 11/2023) còn phải chạy closed test trước khi được publish lên production; kiểm tra số tester và thời gian yêu cầu hiện tại trong Play Console.

### Chính sách
Play đặt hạn `targetSdkVersion` hằng năm, thường vào cuối tháng 8; ví dụ, từ 31/8/2025 app mới và bản cập nhật phải target API 35 (Android 15), và mức này tăng tiếp mỗi năm, nên hãy xem mức hiện tại trong Play Console. Mỗi lần nâng đều đổi hành vi lúc chạy, nên hãy test như một tính năng. Form Data safety trên trang App content phải bao gồm cả dữ liệu mà mọi SDK thu thập. Quyền nhạy cảm như `READ_MEDIA_IMAGES` hay vị trí nền cần lý do là tính năng cốt lõi; nếu không, dùng photo picker của hệ thống hoặc bỏ quyền đó.

### Lỗi chỉ có ở release
Bản release chạy R8 khi bật `minifyEnabled`, đóng gói bytecode Hermes, đặt `__DEV__` là `false`, và chặn HTTP cleartext mà bản debug cho phép để nói chuyện với Metro. R8 đổi tên hoặc xoá mọi thứ chỉ được truy cập bằng reflection, như model của Gson, nên keep rule phải có cả member (`{ *; }`), và mapping file dùng để đọc stack trace. Stack trace của Hermes cũng cần source map.

## Góc phỏng vấn
- "Bạn mất upload key hay app signing key?" Một cái tốn một buổi chiều, cái kia tốn một app mới.
- "Rollback trên Play thế nào?" Không rollback được. Halt, giảm thiệt hại, rồi ra bản có `versionCode` cao hơn.
- "Debug chạy được, release crash. Bạn tìm ở đâu?" `adb logcat` trên bản release, rule và mapping của R8, các nhánh `__DEV__`, traffic cleartext.

## Lỗi thường gặp
- Phát hành với signing config debug của template trong build type `release`
- Keep rule giữ class nhưng không giữ field
- Khai quyền đọc toàn bộ ảnh cho một lần chọn ảnh
- Form Data safety bỏ qua dữ liệu mà SDK thu thập
- Nâng targetSdk vào ngày release mà không test các thay đổi hành vi

## Liên quan
`release-ios-core`, `release-ota-ci-core`, `native/build`
