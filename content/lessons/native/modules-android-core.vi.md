---
id: native-modules-android-core
topic: native/modules-android
kind: core
readMinutes: 6
---
## TL;DR
Native module trên Android là một class Kotlin hoặc Java mà JavaScript gọi bất đồng bộ. Module legacy kế thừa `ReactContextBaseJavaModule` và được đăng ký qua một `ReactPackage`; TurboModule kế thừa một class do Codegen sinh ra từ spec TypeScript, và là mặc định từ RN 0.76. Phần khó ở hai loại giống nhau: chạy việc trên đúng thread, không bao giờ giữ Activity lâu hơn vòng đời của nó, và nhớ rằng nâng `targetSdkVersion` sẽ đổi cách hệ điều hành đối xử với code của bạn.

## Cơ chế bên trong
### Module legacy và package
```kotlin
class CalendarModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "CalendarModule"

  @ReactMethod
  fun createEvent(title: String, promise: Promise) {
    promise.resolve(EventStore.add(title))
  }
}
```
JS thấy đúng chuỗi mà `getName()` trả về. Một `ReactPackage` trả module trong `createNativeModules`. Autolinking đăng ký package của các thư viện trong package.json; package nằm ngay trong app phải tự thêm vào `MainApplication.getPackages()`.

Kiểu tham số map từ JS: `String`, `Boolean`, `Int` hoặc `Double` cho số, `ReadableMap`, `ReadableArray`, `Callback`, `Promise`. Trong Kotlin, tham số mà JS có thể gửi `null` phải là nullable (`String?`), nếu không lời gọi ném lỗi trước khi thân hàm chạy.

### Thread
- `@ReactMethod` bất đồng bộ chạy trên native modules thread, dùng chung cho mọi module. I/O dài ở đó làm trễ mọi module khác, nên hãy chuyển sang executor hoặc coroutine riêng.
- Việc với view đi về UI thread bằng `UiThreadUtil.runOnUiThread { ... }`. Đẩy việc nặng vào đó sẽ gây ANR.
- `@ReactMethod(isBlockingSynchronousMethod = true)` chạy trên JS thread và chặn JS.
- Resolve promise hay emit event từ thread nào cũng được.

### Event
```kotlin
reactApplicationContext
  .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
  .emit("uploadProgress", Arguments.createMap().apply { putDouble("ratio", 0.5) })
```
`NativeEventEmitter` cần module có `addListener(eventName)` và `removeListeners(count)`; hãy dùng chúng để bật, tắt nguồn event native. `WritableMap` bị tiêu thụ khi sang JS, nên mỗi lần gửi phải tạo map mới.

### Activity, lifecycle và leak
`reactApplicationContext` sống cùng React instance. Activity thì không: hãy đọc `reactApplicationContext.currentActivity` khi cần, và xử lý trường hợp `null`. Kết quả của `startActivityForResult` đi qua một `ActivityEventListener` đăng ký bằng `addActivityEventListener`; host resume, pause và destroy đi qua `LifecycleEventListener`. Gỡ cả hai trong `invalidate()`. Không bao giờ lưu Activity vào field static hay singleton sống lâu.

### Quyền và target SDK
Khai báo quyền trong manifest và xin quyền nguy hiểm lúc runtime, qua `PermissionsAndroid` hoặc `PermissionAwareActivity`. Các thay đổi hành vi gắn với `targetSdkVersion` làm vỡ code native cũ: mọi `PendingIntent` phải có cờ mutability rõ ràng (target 31), quyền runtime `POST_NOTIFICATIONS` (target 33), và cờ exported cho `registerReceiver` (target 34).

### TurboModule
Viết spec `Native<Name>.ts` và `codegenConfig` có `android.javaPackageName`. Gradle chạy Codegen trong lúc build và sinh class trừu tượng `Native<Name>Spec`; module kế thừa nó, nên lệch kiểu trở thành lỗi biên dịch. Package chuyển thành `BaseReactPackage` (bản cũ là `TurboReactPackage`).

## Góc phỏng vấn
- "`@ReactMethod` chạy ở đâu?" Trên native modules thread dùng chung, không phải UI thread và không phải JS thread.
- "Lấy kết quả Activity thế nào?" Dùng `ActivityEventListener`, so request code, settle promise đúng một lần.
- "Khi nâng `targetSdkVersion` bạn kiểm tra gì?" Trang behaviour changes của từng level, trong code của mình và trong mọi thư viện native.

## Lỗi thường gặp
- Quên thêm package trong app vào `MainApplication`
- Tham số Kotlin non-null trong khi JS có thể gửi `null`
- Dùng lại `WritableMap` sau khi đã gửi sang JS
- Decode hoặc ghi file bên trong `runOnUiThread`
- Giữ `currentActivity` trong một field hay companion object
- Thiếu `FLAG_IMMUTABLE` hoặc `FLAG_MUTABLE` khi tạo `PendingIntent`

## Liên quan
`native-modules-ios-core`, `native-build-core`, `maintain/crash`
