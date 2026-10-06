---
id: debug-js-lab
topic: debug/js
kind: lab
readMinutes: 12
---
# Tổng tiền sai sau pull to refresh: lần ra đúng dòng code

## Tình huống
Một khách hàng áp coupon, kéo để refresh màn Order, thấy tổng tiền đúng là 95 trong chốc lát, rồi tổng cũ 120 quay lại. Không ai dựng lại được trên Wi-Fi văn phòng. Không có crash, chỉ có dữ liệu sai. Việc của bạn: dựng lại lỗi, tìm đúng dòng ghi giá trị sai, sửa, và chứng minh bản sửa có tác dụng.

## Dựng lại lỗi
Bản tái hiện dùng một API giả với độ trễ cố định: request đầu mất 4 giây, các request sau mất 300 ms. Nó chụp lại tổng tiền lúc request bắt đầu, giống một server thật. Dán đoạn này vào một app thử.

```ts
import { useCallback, useEffect, useState } from 'react';
import { Button, RefreshControl, ScrollView, Text } from 'react-native';

type Order = { orderId: string; total: number };

let serverTotal = 120;
let requestCount = 0;

export function applyCouponOnServer(): void {
  serverTotal = 95;
}

export function fetchOrder(orderId: string): Promise<Order> {
  requestCount += 1;
  const delay = requestCount === 1 ? 4000 : 300; // request đầu chậm
  const snapshot: Order = { orderId, total: serverTotal };
  return new Promise((resolve) => setTimeout(() => resolve(snapshot), delay));
}

export function OrderScreen({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchOrder(orderId);
    setOrder(data);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Button title="Apply coupon on server" onPress={applyCouponOnServer} />
      <Button title="Refresh" onPress={onRefresh} />
      <Text>{`Total: ${order ? order.total : '...'}`}</Text>
    </ScrollView>
  );
}
```

- Mở màn hình; lần load đầu mất 4 giây. Trong khoảng đó, bấm "Apply coupon on server", rồi kéo để refresh (hoặc bấm "Refresh", gọi cùng handler và dễ thao tác hơn trên simulator).
- Sau khoảng 300 ms màn hình hiện `Total: 95`. Khoảng 4 giây sau khi mở, nó đổi thành `Total: 120`.
- Reload app trước mỗi lần thử, vì `requestCount` nằm ở cấp module.

## Đo
Nguyên nhân có thể là server, một lỗi mapping đọc nhầm field, hoặc thứ tự các response trả về.

Log có cấu trúc kèm request id: request nào đã ghi giá trị?
- Gán cho mỗi lần gọi một id, log một dòng JSON khi bắt đầu và khi trả về. Dùng `JSON.stringify`: console giữ tham chiếu tới object, nên mở rộng nó sau đó sẽ thấy trạng thái hiện tại, không phải trạng thái tại thời điểm log.

```ts
let latestId = 0;

const load = useCallback(async (reason: 'mount' | 'refresh') => {
  const requestId = ++latestId;
  const startedAt = Date.now();
  console.log(JSON.stringify({ event: 'order_request', requestId, reason }));
  const data = await fetchOrder(orderId);
  console.log(JSON.stringify({ event: 'order_response', requestId, total: data.total, ms: Date.now() - startedAt }));
  setOrder(data);
}, [orderId]);
```

- Truyền `'mount'` từ effect và `'refresh'` từ `onRefresh`, rồi lặp lại các bước. Ví dụ output của một lần chạy (thời gian trên máy bạn sẽ khác):

```ts
{"event":"order_request","requestId":1,"reason":"mount"}
{"event":"order_request","requestId":2,"reason":"refresh"}
{"event":"order_response","requestId":2,"total":95,"ms":302}
{"event":"order_response","requestId":1,"total":120,"ms":4004}
```

React Native DevTools: code thấy gì ngay lúc nó ghi state? Đây là debugger mặc định từ RN 0.76 và chạy trên dev build.
- Bấm `j` trong terminal đang chạy Metro, hoặc mở từ Dev Menu. Mở panel Sources và tìm file chứa `OrderScreen`.
- Click chuột phải vào số dòng của `setOrder(data)` và thêm conditional breakpoint với điều kiện `requestId !== latestId`. Nó chỉ dừng khi một response cũ sắp được áp vào state.
- Lặp lại các bước. Debugger dừng khoảng 4 giây sau khi mở màn hình. Trong phần Scope, đọc `requestId` (1), `data.total` (120) và, trong closure, `latestId` (2). Nếu điều kiện không thấy được `latestId`, dùng breakpoint thường và tự đọc các giá trị.
- Đọc call stack. Frame trên cùng là `load`, chạy tiếp sau `await`; bên dưới là các frame của promise và timer, không phải handler refresh, nên đây là một callback đến muộn. Async frame hiện hay không tuỳ phiên bản, nên hãy dựa vào `requestId` để nối response với request của nó.
- Khi đang dừng, cả JS thread đứng lại, kể cả timer. Một breakpoint đặt sớm trong `load` có thể đổi timing và che mất race; breakpoint này nằm ở cuối, sau khi cả hai response đã về.
- `debugger;` đặt ở đó chỉ dừng khi có debugger gắn vào; nếu không, nó bị bỏ qua.

React DevTools: component thực sự đang giữ giá trị nào?
- Trong panel Components bên trong React Native DevTools, chọn `OrderScreen`. Danh sách hooks của nó hiện state `order`.
- Lặp lại các bước và quan sát: `total: 95`, rồi vài giây sau là `total: 120`. Prop `orderId` không đổi, nên chính state của component bị ghi đè, không phải nó nhận prop mới.

Mạng: server trả về gì, và lúc nào?
- Từ RN 0.83, React Native DevTools có panel Network (nó ghi `fetch`, `XMLHttpRequest` và `<Image>`): lọc theo endpoint của order và so thời điểm bắt đầu, kết thúc. Với bản cũ hơn, dùng proxy như Charles hay Proxyman, hoặc gửi id trong header `x-request-id` rồi tìm trong log backend. Bạn đang tìm hai request chồng lên nhau, trong đó request bắt đầu trước lại xong sau.

## Đọc tín hiệu
- Hai request chồng lên nhau, và response về theo thứ tự ngược lại: request 2 sau khoảng 300 ms, request 1 sau khoảng 4000 ms. Dòng `order_response` cuối trong log ví dụ thuộc về request cũ hơn.
- Mỗi response đều đúng ở thời điểm của nó: request 1 thật sự thấy 120. Mapping và server đều ổn. Dữ liệu không sai, mà là cũ, và code áp dụng bất cứ thứ gì về sau cùng.
- Conditional breakpoint xác nhận đúng dòng: nó dừng ở `setOrder(data)` với `requestId` là 1 trong khi `latestId` là 2. React DevTools cho thấy hậu quả của dòng đó: state đi từ 95 quay về 120.
- Log cho biết thứ tự, breakpoint chỉ ra dòng code, React DevTools cho thấy tác động. Gộp lại, chúng chứng minh đây là race.

## Sửa
Chỉ áp response nếu nó thuộc request mới nhất. Giữ bộ đếm trong một ref: riêng cho từng instance, không gây thêm render.

```ts
const latestIdRef = useRef(0);

const load = useCallback(async (reason: 'mount' | 'refresh') => {
  const requestId = ++latestIdRef.current;
  const data = await fetchOrder(orderId);
  if (requestId !== latestIdRef.current) {
    console.log(JSON.stringify({ event: 'order_response_ignored', requestId, latestId: latestIdRef.current, reason }));
    return;
  }
  console.log(JSON.stringify({ event: 'order_response_applied', requestId, total: data.total, reason }));
  setOrder(data);
}, [orderId]);

useEffect(() => {
  void load('mount');
  return () => {
    latestIdRef.current += 1; // response về sau khi unmount hoặc đổi orderId đều thành cũ
  };
}, [load]);
```

- Với `fetch` thật, dùng thêm `AbortController`: giữ nó trong một ref, gọi `abort()` trước khi bắt đầu request mới, và truyền `signal` vào `fetch`. Coi `AbortError` sinh ra là chuyện bình thường, không phải lỗi.
- Vẫn giữ phần kiểm tra id dù đã abort. Một response đang được parse dở, hoặc một thư viện bỏ qua signal, vẫn có thể resolve sau khi bạn abort.

## Đo lại
- Cùng các bước: reload, mở màn hình, áp coupon, refresh trong vòng 4 giây.
- Ví dụ output sau khi sửa (thời gian trên máy bạn sẽ khác):

```ts
{"event":"order_response_applied","requestId":2,"total":95,"reason":"refresh"}
{"event":"order_response_ignored","requestId":1,"latestId":2,"reason":"mount"}
```

- Màn hình giữ nguyên `Total: 95`. Trong React DevTools, state `order` đổi một lần rồi đứng yên. Một breakpoint ở `setOrder(data)` với điều kiện `requestId !== latestIdRef.current` không bao giờ dừng, vì response cũ đã return trước khi tới dòng đó.
- Biến bản tái hiện thành unit test với fake timer, thứ cho bạn điều khiển response nào về trước.

Test dùng API của RNTL v12–v13. Ở RNTL v14 (React 19, RN 0.78 trở lên), `render`, `fireEvent` và `act` là async: viết `await render(...)` và `await fireEvent.press(...)`.

```ts
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { OrderScreen } from './OrderScreen';

jest.useFakeTimers();

test('an older response never overwrites a newer one', async () => {
  render(<OrderScreen orderId="42" />); // request 1: 4000 ms, total 120
  fireEvent.press(screen.getByText('Apply coupon on server'));
  fireEvent.press(screen.getByText('Refresh')); // request 2: 300 ms, total 95

  await act(async () => { await jest.advanceTimersByTimeAsync(300); });
  expect(screen.getByText('Total: 95')).toBeTruthy();

  await act(async () => { await jest.advanceTimersByTimeAsync(4000); });
  expect(screen.getByText('Total: 95')).toBeTruthy(); // trước khi sửa thì hiện 120
});
```

- Chạy test với code cũ trước và xem nó fail ở dòng cuối; một test chưa từng fail thì không chứng minh được gì. `advanceTimersByTimeAsync` (từ Jest 29.5) cho promise kịp chạy giữa các timer. Trong project thật, hãy mock module API thay vì dùng bộ đếm cấp module.
- Giữ lại log: ở release build, nơi không gắn được debugger, chúng cho biết race còn xảy ra không.

## Nói trong phỏng vấn
"Màn Order đôi khi hiện tổng tiền cũ sau khi pull to refresh, nên tôi nghi có hai request chồng lên nhau. Tôi thêm log có cấu trúc kèm request id và thấy request 2 về sau 300 ms, còn request 1 về sau 4 giây và được áp vào cuối cùng. Một conditional breakpoint ở `setOrder` với `requestId !== latestId` dừng đúng chỗ đó, và React DevTools cho thấy state đổi từ 95 về lại 120. Tôi sửa bằng cách lưu id của request mới nhất trong một ref và bỏ qua response cũ, cộng thêm `AbortController` cho các lần fetch thật. Sau đó tôi viết một test dùng fake timer tái hiện đúng thứ tự response, thấy nó fail với code cũ và pass với bản sửa."

## Liên quan
`debug-js-core`, `state-async-core`, `testing-unit-lab`, `testing-unit-core`, `render-effects-core`
