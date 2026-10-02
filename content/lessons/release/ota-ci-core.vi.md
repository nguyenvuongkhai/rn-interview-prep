---
id: release-ota-ci-core
topic: release/ota-ci
kind: core
readMinutes: 6
---
## TL;DR
OTA update thay bundle JS và asset của nó trên một binary đã cài. Nó không đổi được native code hay cấu hình native, nên mỗi update chỉ được đến những binary có phần native khớp, và runtime version là thứ khai báo sự khớp đó. CI giúp build và update lặp lại được: cùng secret, cùng cách ký, cùng bước kiểm tra. Versioning nối tất cả lại: version trên store cho binary, runtime version cho tương thích OTA, và version tối thiểu ở server cho việc bắt buộc cập nhật.

## Cơ chế bên trong
### OTA gửi được gì
JS, cùng ảnh và font mà bundle tham chiếu. Không gửi được native module, bản nâng RN, thay đổi Info.plist hay AndroidManifest, hay icon. Thoả thuận developer của Apple cho phép tải code thông dịch nếu không đổi mục đích của app và không lách review; chính sách Device and Network Abuse của Play miễn trừ code chạy trong trình thông dịch như JavaScript.

### Runtime version và channel
Với EAS Update, mỗi build mang một channel và một `runtimeVersion`, và update chỉ đến những build cùng channel và đúng cùng runtime version. Policy `appVersion` chép giá trị `version`, nên nó chỉ an toàn khi team có thói quen tăng `version` mỗi lần native đổi. Policy `fingerprint` băm native project, nên thay đổi native tự sinh runtime version mới. CodePush thể hiện cùng ý này bằng target binary version. Microsoft đã ngừng App Center, gồm cả CodePush hosted, từ 31/3/2025; khái niệm vẫn còn trong các server CodePush tự host.

### Rollback
CodePush giữ bundle mới ở trạng thái chờ cho tới khi app gọi `notifyAppReady()`, việc mà `sync()` tự làm giúp bạn; app khởi động lại trước đó thì quay về bundle cũ. `expo-updates` có cơ chế phục hồi riêng cho update lỗi lúc khởi động. Cả hai đều không bắt được crash ở một màn hình mở sau đó, nên rollback thật sự là republish update tốt gần nhất.

### CI/CD
Fastlane hoặc EAS Build biến một tag thành build đã ký. Giữ thông tin ký ngoài repo: keystore dạng base64 trong secret, `match` readonly trên CI, App Store Connect API key thay cho Apple ID. Lấy build number từ pipeline hoặc từ build mới nhất trên store. Đặt cache key theo đúng thứ được cache: lockfile cho cache của package manager, `Podfile.lock` cho Pods, file Gradle cho Gradle. Upload source map và dSYM cho mọi build và mọi update.

### Bắt buộc cập nhật
Server trả về `latest` và `minSupported` theo từng nền tảng, và app so version native của nó với hai ngưỡng này theo semver, từng phần theo số:

```ts
'2.9.5' < '2.10.0'; // false: chuỗi được so theo từng ký tự
```

Patch thiếu tính là 0, và prerelease nhỏ hơn bản chính thức. Dưới `minSupported` thì app hiện màn hình chặn; dưới `latest` thì hiện lời nhắc người dùng đóng được. Chỉ nâng `minSupported` khi bản mới đã đến được mọi người, và không bao giờ chặn người dùng khi lỗi mạng.

## Góc phỏng vấn
- "Bản sửa này gửi OTA được không?" Chỉ khi nó không đụng tới native và nhắm đúng runtime version.
- "Điều gì chặn update đến một binary không tương thích?" Runtime version, và chỉ khi nó đổi mỗi lần native đổi.
- "Bắt buộc cập nhật thế nào?" Ngưỡng ở server, so semver theo số, và một bước kiểm tra fail-open.

## Lỗi thường gặp
- `runtimeVersion` viết cứng, không đổi khi dependency native đổi
- So sánh chuỗi version bằng `<`
- Export bằng profile development vì CI lấy sai loại `match`
- Tin rằng che log là đủ để bảo vệ secret
- Nâng `minSupported` trong lúc đang staged rollout

## Liên quan
`release-ios-core`, `release-android-core`, `maintain/upgrade`
