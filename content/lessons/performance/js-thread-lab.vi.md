---
id: performance-js-thread-lab
topic: performance/js-thread
kind: lab
readMinutes: 10
---
# Tap không phản hồi sau khi mở app: tìm long task

## Tình huống
Trong vài giây đầu sau khi mở app, tap không có tác dụng gì: nút chỉ phản hồi khi app "tỉnh lại", và màn đầu tiên cũng hiện chậm. Không crash, log không có gì. Trong buổi phỏng vấn, câu hỏi nối tiếp luôn là "làm sao bạn biết thứ gì đang chặn, và làm sao bạn chứng minh bản sửa có tác dụng?"

Nguyên nhân ở đây: lúc khởi động, app đọc một chuỗi JSON lớn từ storage, parse nó, filter và sort hàng chục nghìn bản ghi rồi dựng một index để tra cứu, tất cả đều đồng bộ, trước khi màn đầu tiên kịp phản hồi.

## Dựng lại lỗi
Dán đoạn này vào một app thử, đặt tên `App.tsx`. `storedBlob` thay cho chuỗi bạn sẽ đọc bằng `AsyncStorage.getItem`; bản thân việc đọc chạy ở native và bất đồng bộ, nhưng `JSON.parse` và mọi thứ sau nó chạy trên JS thread.

```ts
import { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';

type Product = { id: string; name: string; price: number; tags: string[] };
type Index = Map<string, Product[]>;

function makeBlob(n: number): string {
  const rows: Product[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({ id: `p${i}`, name: `Product ${(i * 7919) % n}`, price: i % 500, tags: [`t${i % 50}`, `c${i % 7}`] });
  }
  return JSON.stringify(rows);
}
const storedBlob = makeBlob(50_000);
const appStart = performance.now();

export function buildIndex(blob: string): Index {
  const t0 = performance.now();
  const all: Product[] = JSON.parse(blob);
  const visible = all.filter((p) => p.price > 0).sort((a, b) => a.name.localeCompare(b.name));
  const index: Index = new Map();
  for (const p of visible) {
    for (const tag of p.tags) {
      const list = index.get(tag) ?? [];
      list.push(p);
      index.set(tag, list);
    }
  }
  console.log(`[perf] buildIndex ${Math.round(performance.now() - t0)} ms`);
  return index;
}

export default function App() {
  const [index, setIndex] = useState<Index>(() => buildIndex(storedBlob));
  const [taps, setTaps] = useState(0);

  useEffect(() => {
    console.log(`[perf] first screen ready ${Math.round(performance.now() - appStart)} ms`);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>{index.size} tags</Text>
      <Button title={`Tapped ${taps}`} onPress={() => setTaps((n) => n + 1)} />
      {__DEV__ && <Button title="Rebuild index" onPress={() => setIndex(buildIndex(storedBlob))} />}
    </View>
  );
}
```

- `buildIndex` chạy trong hàm khởi tạo của `useState`, nên lần render đầu không thể xong cho tới khi nó trả về.
- `first screen ready` là một mốc time-to-interactive đơn giản phía JS: effect đầu tiên của màn đầu chỉ chạy sau lần commit đầu. Mốc này tính từ lúc blob đã có và không gồm phần khởi động native; muốn theo dõi cold start qua các bản release, xem `maintain-regression-core`.
- `Rebuild index` là nút chỉ có ở dev, chạy lại đúng hàm đó, để bạn record profile mà không phải canh đúng lúc khởi động.
- Việc tạo blob chỉ là phần dựng thử, nên `appStart` được lấy sau nó. Nếu máy bạn đứng quá ngắn, hãy tăng `50_000`.

## Đo
Dùng ba công cụ, mỗi công cụ trả lời một câu hỏi.

- Thread nào bị chặn? Chạy debug build, mở Dev Menu (lắc máy, `Cmd+D` trên iOS Simulator, `Cmd+M` trên Android emulator) và bật Perf Monitor. Mở lại app và tap nút ngay lập tức. Theo dõi hai bộ đếm: UI và JS.
- Thời gian JS đi đâu? Mở React Native DevTools, debugger mặc định từ RN 0.76, bằng cách bấm `j` trong terminal của Metro hoặc chọn mục mở DevTools trong Dev Menu. Mở panel record JS CPU profile từ sampling profiler của Hermes (panel Performance, có từ RN 0.83; với bản cũ hơn, xem trang Hermes profiling trong tài liệu RN của phiên bản bạn dùng). Bắt đầu record, bấm `Rebuild index`, đợi tới khi nút phản hồi, rồi dừng.
- Mất bao lâu, bằng con số tin được? Build release (ví dụ `npx react-native run-android --mode release`) và đọc các dòng `[perf]` bằng `adb logcat` lọc theo `ReactNativeJS` trên Android, hoặc trong console của Xcode trên iOS. Cold start app năm lần trên cùng một máy và ghi lại trung vị.

Perf Monitor và DevTools cần debug build, vốn chạy chậm hơn nhiều. Dùng chúng để tìm thời gian đi đâu, còn con số bạn báo cáo phải lấy từ release build.

## Đọc tín hiệu
Con số ví dụ từ một máy Android tầm trung; trên máy bạn sẽ khác.

- Perf Monitor: UI giữ gần 60 FPS trong khi JS rơi xuống 0 hoặc 1 trong khoảng hai giây. Phía native vẫn ổn; JS thread đang bận, nên touch vẫn tới native nhưng không handler JS nào chạy cho tới khi thread rảnh. Nếu UI cũng rơi, bạn sẽ phải xem phần việc native.
- Flame chart: thời gian chạy từ trái sang phải, và độ rộng của một thanh là thời gian lời gọi đó chạy. Bạn thấy một thanh rộng cho `buildIndex`, dài khoảng 1,4 s. Bên dưới, stack tách thành `JSON.parse`, `sort` với các lời gọi `localeCompare` bên dưới nó, và vòng lặp dựng index. Hàm built-in native có thể hiện bằng tên riêng hoặc bị gộp chung. Dùng view bottom-up, sort theo self time, để xếp hạng các hàm.
- Một thanh rộng nghĩa là một task đồng bộ dài: một frame kéo dài khoảng 16,6 ms ở 60 Hz, nên một task 1,4 s chặn khoảng 80 frame liên tiếp. Nhiều thanh hẹp xếp sát nhau không có khoảng trống là một vấn đề khác, death by a thousand cuts: không có một hàm nào để sửa, nên bạn giảm số lần việc đó chạy.
- Log release (ví dụ): `buildIndex 1400 ms`, `first screen ready 2300 ms`.

## Sửa
Chỉ làm những gì frame đầu tiên cần, phần còn lại chia thành các lát nhỏ, mỗi lát trả thread lại.

```ts
const yieldToUI = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function buildIndexInChunks(blob: string, budgetMs = 8): Promise<Index> {
  const t0 = performance.now();
  const all: Product[] = JSON.parse(blob);
  const index: Index = new Map();
  let sliceStart = performance.now();
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    if (p.price > 0) {
      for (const tag of p.tags) {
        const list = index.get(tag) ?? [];
        list.push(p);
        index.set(tag, list);
      }
    }
    if (i % 200 === 0 && performance.now() - sliceStart > budgetMs) {
      await yieldToUI();
      sliceStart = performance.now();
    }
  }
  console.log(`[perf] index ready ${Math.round(performance.now() - t0)} ms`);
  return index;
}
```

Trong `App`, khởi tạo bằng `useState<Index | null>(null)`, render một placeholder, và bắt đầu việc từ effect đầu tiên bằng `setTimeout(..., 0)` để frame đầu được vẽ trước. Giữ một cờ `cancelled` trong cleanup của effect để không bao giờ set state sau khi unmount. `InteractionManager.runAfterInteractions` là một cách hoãn khác; hãy tra trạng thái của nó trong tài liệu của phiên bản RN bạn dùng.

- `setTimeout` nhường bằng một macrotask, nên tap và frame được xử lý giữa các lát. `await Promise.resolve()` thì không; xem `performance-js-thread-008`.
- Việc sort bị bỏ khỏi lúc khởi động: sort danh sách của một tag khi tag đó được mở, hoặc lưu dữ liệu đã sort và đã index sẵn ngay lúc ghi, để lúc khởi động chỉ cần đọc.
- `JSON.parse` không chia nhỏ được. Hãy giảm lượng phải parse: tách blob thành nhiều key nhỏ, chỉ tải phần màn đầu cần, hoặc giữ dữ liệu trong SQLite (ví dụ `expo-sqlite` hay `op-sqlite`) và chỉ query những dòng bạn hiển thị.

## Đo lại
Cùng loại release build, cùng máy, năm lần cold start, so sánh trung vị. Con số ví dụ; trên máy bạn sẽ khác.

- `first screen ready` giảm từ 2.300 ms xuống 600 ms. Thời gian lâu nhất một tap phải chờ giờ là một lời gọi `JSON.parse`, không còn là cả 1,4 s.
- Perf Monitor (debug build): JS có giảm khi các lát chạy nhưng không còn nằm ở 0; tap được nhận giữa các lát.
- Flame chart (cho nút `Rebuild index` gọi hàm mới): thanh `buildIndex` rộng trở thành một dãy lát ngắn. Vẫn còn một thanh cho `JSON.parse`, khoảng 350 ms trong ví dụ này; đó là mục tiêu tiếp theo.
- Chia lát tốn thêm một ít overhead, nên việc dựng index xong muộn hơn so với chạy một lèo. Điều đó là bình thường: chia lát không làm việc rẻ đi, nó giúp app phản hồi trong lúc việc vẫn chạy.

## Nói trong phỏng vấn
"Tap bị chết trong hai giây sau khi mở app. Perf Monitor cho thấy UI ở 60 và JS ở 0, nên vấn đề nằm ở JS thread. Profile Hermes cho thấy một task dài 1,4 giây: parse, sort và dựng index lúc khởi động. Tôi cho màn đầu render trước, chuyển việc dựng index thành các lát có giới hạn thời gian và nhường thread bằng `setTimeout`, bỏ sort lúc khởi động và giảm lượng dữ liệu phải parse. Trên release build và cùng một máy, trung vị thời gian tới màn đầu giảm từ 2,3 xuống 0,6 giây, và lần đứng lâu nhất chỉ còn là bước parse, phần chúng tôi đang cắt tiếp."

## Liên quan
`performance-js-thread-core`, `maintain-regression-core`, `state-async-core`
