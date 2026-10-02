---
id: native-modules-ios-core
topic: native/modules-ios
kind: core
readMinutes: 6
---
## TL;DR
Native module trên iOS là một class Objective-C, Objective-C++ hoặc Swift mà JavaScript gọi bất đồng bộ. Module legacy tự đăng ký bằng macro; TurboModule bắt đầu từ một spec TypeScript mà Codegen biến thành interface native, và là mặc định từ RN 0.76. Dù viết loại nào, ba điều quyết định module có đúng hay không: mỗi phần chạy trên thread nào, mọi promise có settle đúng một lần không, và có gì giữ module sống sau khi JS thôi dùng nó không.

## Cơ chế bên trong
### Module legacy
```objc
@implementation CalendarModule
RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(createEvent:(NSString *)title
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  resolve([EventStore.shared add:title]);
}
@end
```
`RCT_EXPORT_MODULE()` đưa class ra JS dưới tên của nó. Mỗi method được export thành một hàm JS bất đồng bộ. Callback (`RCTResponseSenderBlock`) hoặc cặp promise phải được gọi đúng một lần, trên mọi nhánh.

### Thread
- Method bất đồng bộ chạy trên `methodQueue` của module. Mặc định mỗi module legacy có một serial queue riêng, nên lời gọi giữ thứ tự và không chạy trên main thread.
- Việc UIKit phải đẩy về main queue bằng `dispatch_async(dispatch_get_main_queue(), ...)`, hoặc module trả `dispatch_get_main_queue()` từ `methodQueue` khi nó chỉ làm UI.
- `+ requiresMainQueueSetup` trả `YES` khiến phần khởi tạo, và `constantsToExport` của module legacy, chạy trên main thread. Nó không chuyển lời gọi method. Hãy giữ nó nhẹ: nó có thể chạy ngay lúc mở app.
- `RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD` chạy trên JS thread và chặn JS.

### TurboModule và Codegen
Spec là một file như `NativeCalendar.ts` nằm trong thư mục `jsSrcsDir` khai báo ở `codegenConfig` của package.json. Nó export `TurboModuleRegistry.getEnforcing<Spec>('Calendar')`. Trên iOS, Codegen chạy trong lúc `pod install`, và build phase `Generate Specs` của pod `ReactCodegen` chạy lại nó khi spec thay đổi. Nó sinh ra một protocol Obj-C++ cùng một class C++ JSI. Class `.mm` của bạn conform protocol đó và trả class JSI từ `getTurboModule:`. Giá trị được chuyển kiểu bằng code sinh ra, nên spec chính là hợp đồng. TurboModule được load lazy ở lần dùng đầu tiên. Interop layer giúp nhiều module legacy vẫn chạy dưới kiến trúc mới.

### Swift
Với module legacy, một class Swift `@objc(Name)` được khai báo cho React Native từ file `.m` bằng `RCT_EXTERN_MODULE` và `RCT_EXTERN_METHOD`. Selector của Swift phải khớp tuyệt đối: `func createEvent(_ title: String, ...)`, không phải `createEvent(title:)`. Vì spec sinh ra dùng kiểu C++, một TurboModule viết bằng Swift cần một class `.mm` mỏng conform spec và chuyển tiếp sang Swift.

### Event
Kế thừa `RCTEventEmitter`, liệt kê tên trong `supportedEvents`, và gọi `sendEventWithName:body:` từ thread nào cũng được. Listener phía JS được đếm: `startObserving` chạy ở listener đầu tiên, `stopObserving` sau listener cuối. Event gửi lúc không có listener bị bỏ, nên hãy gửi trạng thái hiện tại khi bắt đầu observe.

### Bộ nhớ
Block truyền cho NotificationCenter hay SDK giữ `self` mạnh. Gỡ observer trong `stopObserving` hoặc `invalidate`, và bắt `self` qua `__weak`, nếu không các instance cũ sống sót qua mỗi lần reload.

### View native
`RCTViewManager` legacy trả view mới từ `view` và export prop bằng `RCT_EXPORT_VIEW_PROPERTY`. Component Fabric bắt đầu từ `codegenNativeComponent`, và phía iOS là một `RCTViewComponentView` áp prop trong `updateProps:oldProps:` và reset trạng thái trong `prepareForRecycle`.

## Góc phỏng vấn
- "Method của tôi chạy trên thread nào?" Trên method queue của nó, không bao giờ là main thread trừ khi bạn yêu cầu; method đồng bộ chạy trên JS thread.
- "Module legacy hay TurboModule?" Code mới thì viết spec và dùng Codegen; module cũ có thể chuyển sau, với interop layer làm cầu nối.

## Lỗi thường gặp
- Gọi UIKit từ method được export mà không đẩy về main queue
- Nghĩ rằng `requiresMainQueueSetup` chuyển lời gọi method về main thread
- Nhãn tham số Swift làm đổi selector được export
- Một nhánh code không bao giờ resolve hay reject promise
- Gán token observer về `nil` thay vì gỡ observer

## Liên quan
`native-modules-android-core`, `native-build-core`, `architecture/new-arch`
