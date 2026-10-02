---
id: maintain-upgrade-core
topic: maintain/upgrade
kind: core
readMinutes: 6
---
## TL;DR
Nâng cấp React Native là thay đổi project native của bạn, không chỉ là đổi version trong `package.json`. Template, mọi thư viện native, toolchain build và các workaround cũ của chính bạn cùng thay đổi một lúc. Hãy nâng theo từng chặng nhỏ, giữ mỗi chặng build được trên cả hai nền tảng, và phát hành nó như mọi bản release rủi ro khác.

## Cơ chế bên trong
### Thứ thật sự thay đổi
Package `react-native` chứa JS, code native và một project template. Thư mục `ios/` và `android/` của bạn được tạo từ một template cũ và giờ thuộc về bạn, nên không có gì tự cập nhật chúng. React Native Upgrade Helper hiển thị diff template giữa hai version bất kỳ: `package.json`, `Podfile`, `build.gradle`, `gradle.properties`, AppDelegate, MainApplication, cấu hình Metro và Babel. Bạn tự áp từng hunk và phải hiểu nó, vì project thật đã khác template.

### Thư viện và New Architecture
Từ RN 0.76, New Architecture bật mặc định. Từ 0.74, lớp interop được bật tự động, nên nhiều module và view kiến trúc cũ vẫn chạy, nhưng không phải tất cả. Hãy tra React Native Directory và kiểm thử mọi màn hình dùng thư viện cũ. Tới 0.81 bạn còn tắt tạm được bằng `newArchEnabled=false` và `RCT_NEW_ARCH_ENABLED=0`; theo release notes của 0.82, từ bản đó kiến trúc cũ không bật lại được nữa.

RN 0.78 mang tới React 19 (0.76 và 0.77 đi kèm React 18.3), gây xung đột với các thư viện khai báo peer `react@^18`. App vẫn phải có đúng một bản React.

### Toolchain
Mỗi lần nâng thường kéo theo mức tối thiểu mới: Xcode, iOS deployment target (15.1 từ RN 0.76), JDK (17 từ 0.73), và Android Gradle Plugin (8 từ 0.73, bắt buộc mỗi module khai báo `namespace` trong `build.gradle`). Rất nhiều lỗi "không build được nữa" là lỗi toolchain, không phải lỗi code. Sau khi đổi toolchain, hãy dọn Pods, DerivedData và cache Gradle trước khi debug thứ khác.

### Những thứ bạn tự để lại
Upgrade Helper không thấy được những gì không có trong template: `resolutions` và `overrides`, file trong `patches/`, cấu hình Metro và Babel tuỳ chỉnh. Hãy rà từng cái. Pin cũ cho các package như `@react-native/codegen` làm build vỡ mà không báo rõ, và một patch chỉ gắn với đúng một version thư viện. Khi mang cấu hình tuỳ chỉnh sang, hãy mở rộng giá trị mặc định:

```ts
// metro.config.js (trích)
const defaults = getDefaultConfig(__dirname);
const config = {
  resolver: { sourceExts: [...defaults.resolver.sourceExts, 'svg'] },
};
module.exports = mergeConfig(defaults, config);
```

`mergeConfig` merge object nhưng thay thế mảng, nên `sourceExts: ['svg']` sẽ xoá mất `.ts` và `.js`.

### Phát hành
Kiểm thử bằng release build trên máy thật, vì Hermes bytecode và R8 chỉ có ở đó. Phát nội bộ trước, rồi rollout theo giai đoạn với ngưỡng dừng đã thống nhất trước. Đổi runtime version của OTA vì native đã đổi. Binary không rollback được; bản nâng cấp lỗi phải sửa bằng version code cao hơn.

## Góc phỏng vấn
- "Bạn nâng một app chậm năm version thế nào?" Kiểm kê dependency native, nâng theo chặng, tách riêng bước New Architecture, rồi rollout theo giai đoạn.
- "Một thư viện không hỗ trợ New Architecture, bạn có những lựa chọn nào?" Dựa vào interop sau khi kiểm thử, nâng thư viện, patch, thay thế, hoặc tắt tạm nếu version còn cho phép.

## Lỗi thường gặp
- Bỏ qua hoặc chép mù các hunk của template, ví dụ ghi cứng version trong `platform :ios`
- Thay thế mảng mặc định của Metro thay vì mở rộng nó
- Để lại các pin `resolutions` hay `overrides` cũ
- Ghim thư viện đã patch bằng range `^`
- Cài thêm một bản React để thoả peer dependency
- Quên đổi runtime version của OTA
- Chỉ kiểm thử bằng debug build

## Liên quan
`maintain-crash-core`, `maintain-regression-core`, `architecture/new-arch`, `release/ota-ci`
