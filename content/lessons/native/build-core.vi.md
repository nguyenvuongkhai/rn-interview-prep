---
id: native-build-core
topic: native/build
kind: core
readMinutes: 6
---
## TL;DR
Một app React Native gồm hai project native và một JS bundle. CocoaPods và Xcode build phía iOS, Gradle build phía Android, autolinking nối các thư viện trong package.json vào, và Codegen sinh phần keo cho TurboModule và component Fabric. Phần lớn sự cố build đến từ bốn chỗ: một bước không được chạy lại, phiên bản lệch khỏi template, cấu hình khác nhau giữa debug và release, hoặc signing.

## Cơ chế bên trong
### iOS: CocoaPods và Xcode
`pod install` đọc Podfile. `use_native_modules!` thêm pod cho mọi thư viện được autolink, `use_react_native!` thêm chính React Native, và `react_native_post_install` phải chạy bên trong hook `post_install` duy nhất. Trên iOS, Codegen cũng chạy trong lúc `pod install`, và chạy lại trong build phase của pod `ReactCodegen`. Hãy chạy lại mỗi khi một dependency native hay một spec thay đổi, commit `Podfile.lock`, và cố định phiên bản CocoaPods bằng `Gemfile` của template (`bundle exec pod install`).

```ruby
post_install do |installer|
  react_native_post_install(installer, config[:reactNativePath], :mac_catalyst_enabled => false)
  # cấu hình thêm của bạn đặt ở đây, trong cùng hook
end
```

Trong Xcode, scheme chọn build configuration. Debug load JS từ Metro; Release nhúng `main.jsbundle` qua phase `Bundle React Native code and images`. Configuration tuỳ chỉnh như Staging cũng phải được map trong Podfile (`project 'App', 'Staging' => :release`), nếu không pod sẽ build sai kiểu.

### Android: Gradle
Project gốc cố định Gradle wrapper, Android Gradle Plugin và Kotlin, cùng `minSdkVersion`, `compileSdkVersion` và `targetSdkVersion`:

- `minSdkVersion`: bản Android cũ nhất cài được app
- `compileSdkVersion`: bộ API dùng để biên dịch
- `targetSdkVersion`: các thay đổi hành vi mà app chấp nhận áp dụng

Từ AGP 8 (RN 0.73 trở lên), mỗi module khai báo `namespace` trong `build.gradle` của nó. Block `react { }` cấu hình RN Gradle plugin: `debuggableVariants` liệt kê các variant bỏ qua bước bundle, và từ RN 0.75 `autolinkLibrariesWithApp()` lo phần autolinking. Codegen chạy như một phần của Gradle build. `newArchEnabled` và `hermesEnabled` nằm trong `gradle.properties`.

### Autolinking
CLI đọc dependency từ package.json và cấu hình native của từng thư viện; `npx react-native config` cho xem kết quả. `react-native.config.js` có thể tắt một dependency theo từng nền tảng. Code nằm trong chính app không bao giờ được autolink.

### Debug và release
Bản release được minify (R8 khi bật `minifyEnabled`), đặt `__DEV__` là `false`, nhúng sẵn bundle, và thường dùng biến môi trường cùng entitlements khác. Thư viện dùng reflection cần keep rule. Hãy chạy bản release trên máy thật trước mỗi lần phát hành.

### Signing
Android: template ký bản release bằng debug keystore. Thêm signing config `release` đọc upload key từ `gradle.properties`, giữ keystore ngoài git, và nhớ rằng Play App Signing ký lại bằng app signing key. iOS: một certificate cùng một provisioning profile có app ID và entitlements khớp với capability của target.

### Kiến trúc mới
Bật mặc định từ RN 0.76, có thể tắt bằng `newArchEnabled=false` (Android) hoặc `RCT_NEW_ARCH_ENABLED=0` khi chạy `pod install` (iOS). Từ RN 0.82, kiến trúc mới không tắt được nữa, và các cờ tắt đó bị bỏ qua.

## Góc phỏng vấn
- "Build vỡ sau khi nâng cấp. Bạn bắt đầu từ đâu?" Từ lỗi thật đầu tiên, rồi so với template bằng Upgrade Helper.
- "Chỉ chạy được ở debug. Vì sao?" R8, `__DEV__`, bundle nhúng sẵn, cấu hình môi trường hoặc signing.

## Lỗi thường gặp
- Quên `pod install` sau khi thêm thư viện native
- Hai hook `post_install` trong một Podfile
- Bản release vẫn ký bằng `signingConfigs.debug`
- Một variant release nằm trong `debuggableVariants`
- Thư viện thiếu `namespace` khi dùng AGP 8
- Kotlin hoặc `compileSdkVersion` bị lệch sau khi nâng cấp

## Liên quan
`native-modules-ios-core`, `native-modules-android-core`, `maintain/upgrade`, `release/android`
