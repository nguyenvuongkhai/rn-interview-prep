---
id: render-effects-lab
topic: render/effects
kind: lab
readMinutes: 12
---
# Tìm và chứng minh memory leak của một màn hình

## Tình huống
QA báo rằng mở rồi đóng màn chi tiết đơn hàng 30 lần thì app dùng nhiều bộ nhớ hơn hẳn, và không bao giờ giảm lại. Trên máy cũ, OS cuối cùng kill app. Bạn nghi các effect của màn này. Việc của bạn: dựng lại leak, tìm thứ đang bị giữ lại, sửa, và đưa ra con số chứng minh bản sửa có tác dụng.

## Dựng lại lỗi
Dán đoạn code này vào một app thử. Nó có ba leak kinh điển: listener không được gỡ, interval không bị clear, và một cache cấp module giữ closure làm một mảng lớn sống mãi. Object `stats` là bộ đếm rẻ tiền, cũng là tín hiệu đầu tiên bạn dùng.

```ts
import { useEffect, useState } from 'react';
import { AppState, Button, Keyboard, Text, View } from 'react-native';

export const stats = { mounted: 0, listeners: 0, timers: 0 };
const cache = new Map<string, () => number>();

function OrderDetails({ orderId }: { orderId: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    stats.mounted++;
    const rows = Array.from({ length: 100_000 }, (_, i) => ({ i, label: `row ${i}` }));
    cache.set(`${orderId}-${Date.now()}`, () => rows.length); // keeps rows alive

    AppState.addEventListener('change', () => setTick((t) => t + 1));
    Keyboard.addListener('keyboardDidShow', () => setTick((t) => t + 1));
    stats.listeners += 2;
    setInterval(() => setTick((t) => t + 1), 1000);
    stats.timers++;

    return () => { stats.mounted--; };
  }, [orderId]);

  return <Text>Order {orderId}, tick {tick}</Text>;
}

export function LeakHarness() {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Button title="Toggle screen" onPress={() => setOpen((o) => !o)} />
      <Button title="Log stats" onPress={() => console.log(JSON.stringify(stats))} />
      {open && <OrderDetails orderId="42" />}
    </View>
  );
}
```

- Bấm "Toggle screen" 20 lần (10 vòng mở/đóng), rồi bấm "Log stats".
- `mounted` quay về 0 vì cleanup có giảm nó, nhưng `listeners` và `timers` cứ tăng. Khoảng chênh đó chính là leak: component đã mất, nhưng subscription của nó vẫn còn.
- Khi dev có Strict Mode, mỗi lần mount chạy effect hai lần, nên bộ đếm tăng nhanh gấp đôi. Đó không phải bug riêng; nó cho thấy cleanup chưa đủ.

## Đo
Dùng ba tầng. Mỗi tầng trả lời một câu hỏi khác nhau.

JS heap: React Native DevTools (debugger mặc định từ RN 0.76, chỉ với Hermes).
- Mở DevTools từ Dev Menu hoặc bấm `j` trong terminal của Metro, rồi mở panel Memory.
- Nếu panel có nút ép garbage collection thì bấm nó. Chụp một heap snapshot: đây là baseline.
- Chạy 10 vòng mở/đóng, ép GC lần nữa, chụp snapshot thứ hai.
- Chuyển snapshot thứ hai sang chế độ so sánh với snapshot đầu. Sắp xếp theo độ chênh kích thước, và dùng ô lọc class để tìm tên trong code của bạn, như `OrderDetails` hoặc chuỗi label.
- Chọn một object bị giữ lại và đọc đường retainers của nó. Nó cho biết ai vẫn đang giữ object: ở đây là Map `cache` giữ một closure, closure đó giữ `rows`; và registry listener của `AppState` và `Keyboard` giữ các closure tham chiếu tới `setTick`.
- DevTools chỉ kết nối với development build. Dùng nó để tìm thứ bị giữ lại; phần bộ nhớ dev thêm vào (dev tools, source map, Strict Mode) làm sai tổng số, chứ không đổi việc object nào của bạn còn sống.

Bộ nhớ native của process, trên release build.
- iOS: trong Xcode, Product > Profile mặc định build cấu hình Release rồi mở Instruments. Chọn template Allocations. Sau mỗi vòng mở/đóng, dùng thao tác mark generation của Allocations. Mỗi generation cho thấy phần bộ nhớ cấp phát từ lần mark trước mà vẫn còn sống. Hermes heap nằm trong bộ nhớ native, nên JS tăng thì ở đây cũng thấy. Nếu các generation tăng ít, hãy xem thêm persistent bytes của All Anonymous VM, nơi Hermes giữ heap của nó.
- Instrument Leaks tìm bộ nhớ native không còn ai tham chiếu, như retain cycle trong Objective-C hay Swift. Leak bên JS vẫn đang được tham chiếu, nên Leaks thường không báo gì. Leaks sạch không có nghĩa phía JS sạch.
- Android: chạy một build profileable hoặc gần với release (release build profileable cần Android 10 trở lên) và mở phần memory của Android Studio Profiler. Theo dõi tổng bộ nhớ và mục Native, ép garbage collection giữa các vòng, và lấy heap dump nếu nghi object Java hoặc Kotlin. Hermes heap không thuộc Java heap; tuỳ thiết bị, nó được tính vào Native hoặc Others, nên hãy theo dõi tổng, và heap dump Java không cho thấy object JS của bạn.
- LeakCanary là thư viện cho debug build, phát hiện Activity, Fragment và View đã bị destroy mà vẫn còn được tham chiếu. Thêm nó khi bạn nghi một native module giữ Activity hoặc Context. Nó không nhìn thấy JS heap.

## Đọc tín hiệu
- Bình thường: bộ nhớ tăng khi màn đang mở, rồi giảm về gần baseline sau khi đóng màn và GC chạy. Đồ thị có dạng răng cưa, quay về cùng một mức nền.
- Leak: chính mức nền tăng lên một lượng gần như nhau sau mỗi vòng. Đồ thị có dạng bậc thang, và ép GC cũng không kéo nó xuống.
- Ví dụ từ một lần chạy (trên máy bạn con số sẽ khác): JS heap baseline là 38 MB; sau 10 vòng và một lần ép GC là 96 MB, khoảng 6 MB mỗi vòng. Chế độ so sánh cho thấy khoảng một triệu object `row` mới và 10 bản closure của effect vẫn còn bị giữ.
- Ví dụ trên Instruments, release build: mỗi generation thêm khoảng 6 MB bộ nhớ còn sống, và các generation sau không giải phóng phần nào.
- Bộ đếm khớp với nhau: `listeners: 20`, `timers: 10` trong khi `mounted: 0`. Khi bộ đếm, snapshot và đồ thị native cùng chỉ một hướng, bạn có nguyên nhân, không phải phỏng đoán.

## Sửa
Hoàn tác mọi side effect trong cleanup, và giới hạn cache.

```ts
const MAX_CACHED = 5;
const cache = new Map<string, number>();

function remember(key: string, value: number) {
  cache.set(key, value);
  if (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

useEffect(() => {
  stats.mounted++;
  const rows = Array.from({ length: 100_000 }, (_, i) => ({ i, label: `row ${i}` }));
  remember(orderId, rows.length); // store the result, not a closure over rows

  const appSub = AppState.addEventListener('change', () => setTick((t) => t + 1));
  const kbSub = Keyboard.addListener('keyboardDidShow', () => setTick((t) => t + 1));
  stats.listeners += 2;
  const id = setInterval(() => setTick((t) => t + 1), 1000);
  stats.timers++;

  return () => {
    appSub.remove();
    kbSub.remove();
    clearInterval(id);
    stats.mounted--;
    stats.listeners -= 2;
    stats.timers--;
  };
}, [orderId]);
```

- Gọi `remove()` trên đúng subscription bạn đã tạo. Subscription của `NativeEventEmitter` cũng làm như vậy. Đừng dùng `removeAllListeners`, vì nó gỡ cả listener của component khác.
- Cache cấp module sống lâu bằng app. Chỉ cache kết quả nhỏ, dùng key ổn định, và giới hạn kích thước.

## Đo lại
- Lặp lại đúng các bước: cùng loại build, cùng số vòng, ép GC trước mỗi snapshot.
- Bộ đếm sau 10 vòng: `{"mounted":0,"listeners":0,"timers":0}`. Với Strict Mode chúng vẫn về 0, chứng tỏ cleanup đã đủ.
- Ví dụ (con số của bạn sẽ khác): baseline 38 MB, sau 10 vòng là 39 MB. Chế độ so sánh không còn closure `OrderDetails` nào bị giữ và không còn object `row` nào; cache chỉ giữ một con số cho order 42.
- Ví dụ trên Instruments, release build: các generation sau generation đầu đều dưới 0,3 MB và không cộng dồn. Đồ thị quay lại dạng răng cưa.
- Để kiểm tra một leak nhỏ, tăng lên 50 vòng: leak nhỏ lẫn trong nhiễu khi chạy vài vòng, nhưng thành bậc thang rõ ràng khi chạy nhiều vòng.

## Nói trong phỏng vấn
"Tôi dựng lại lỗi bằng một harness mount rồi unmount màn hình liên tục, và thêm bộ đếm cho listener và timer đang sống. Số listener cứ tăng trong khi mounted vẫn bằng 0. Hai heap snapshot trong React Native DevTools, so sánh sau khi ép GC, cho thấy closure của màn bị listener của AppState và Keyboard giữ lại, và một cache cấp module giữ một mảng lớn. Tôi gỡ từng subscription trong cleanup, clear interval và giới hạn cache. Sau đó tôi xác nhận trên release build bằng generation của Instruments: bộ nhớ mỗi vòng giảm từ khoảng 6 MB xuống gần 0, và bộ đếm về 0."

## Liên quan
`render-effects-core`, `maintain-regression-core`, `maintain-crash-core`, `native/modules-android`
