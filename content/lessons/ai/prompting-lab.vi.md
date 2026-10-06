---
id: ai-prompting-lab
topic: ai/prompting
kind: lab
readMinutes: 11
---
# Sửa memory leak cùng AI assistant, và chứng minh bản sửa

## Tình huống
QA báo rằng mỗi lần người dùng mở rồi đóng màn Activity, bộ nhớ lại tăng và không bao giờ giảm. Hai ngày nữa là release, nên bạn muốn sửa nhanh với một AI assistant. App chạy RN 0.77 với React 18.3. Màn hình subscribe `AppState` để refresh khi app quay lại foreground. Việc của bạn: lấy được bản sửa đúng từ assistant, bắt được nó khi nó sai, và đưa ra con số chứng minh bản sửa cuối cùng có tác dụng. Assistant viết code; kiểm chứng vẫn là việc của bạn.

## Dựng lại lỗi
Đây là màn hình, đã rút gọn còn phần quan trọng. Bộ đếm `stats` lấy từ lab memory leak trong `render-effects-lab`: nó là tín hiệu đầu tiên, rẻ tiền, cho số subscription còn sống.

```ts
import { useEffect, useState } from 'react';
import { AppState, Text } from 'react-native';

export const stats = { listeners: 0 };

export function ActivityScreen({ userId }: { userId: string }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const samples = Array.from({ length: 50_000 }, (_, i) => ({ i, userId }));
    AppState.addEventListener('change', (next) => {
      setLabel(`${next}: ${samples.length} samples`);
    });
    stats.listeners++;
  }, [userId]);

  return <Text>{label}</Text>;
}
```

- Mount rồi unmount màn hình 10 lần bằng một nút toggle, sau đó log `stats`. `listeners` báo 10 dù không còn màn nào mở.
- Mỗi listener nằm lại trong registry của `AppState`, và closure của nó giữ `samples` cùng `setLabel` sống mãi. Màn hình đã mất, nhưng bộ nhớ của nó thì chưa.

Khi bị ép thời gian, prompt đầu tiên thường là thế này:

```text
My screen leaks memory, fix it.
```

## Đo
Ở đây, đo nghĩa là kiểm tra câu trả lời của assistant trước khi tin nó. Một câu trả lời điển hình cho prompt mơ hồ nghe rất tự tin và trông hợp lý:

```ts
const onChange = useCallback((next: AppStateStatus) => {
  setLabel(next);
}, []);

useEffect(() => {
  AppState.addEventListener('change', onChange);
  return () => AppState.removeEventListener('change', onChange);
}, [onChange]);
```

Nó còn gợi ý bọc màn hình trong `React.memo`. Hãy kiểm tra theo ba cách.

- Đọc diff từng dòng. `useCallback` và `React.memo` thay đổi tần suất re-render; không cái nào thay đổi thời điểm một subscription kết thúc. Diff còn bỏ mất `samples` và dependency `userId`, tức là lặng lẽ đổi hành vi mà bạn không hề yêu cầu.
- Đối chiếu mọi API với phiên bản bạn đang cài, không phải với lời assistant. `AppState.addEventListener` trả về một subscription có `remove()` từ RN 0.65, còn `AppState.removeEventListener` bị deprecate từ đó và sau này bị xoá. Tìm `removeEventListener` trong type definitions của AppState bên trong `node_modules/react-native`: trên RN 0.77 nó không có. Type check sẽ báo lỗi ở dòng đó, và lúc chạy thì cleanup ném TypeError khi màn hình unmount.
- Chạy lại bộ đếm và kiểm tra heap như trước. Không cần lặp lại toàn bộ phương pháp: làm theo `render-effects-lab` để so sánh heap snapshot trong React Native DevTools, và dùng Instruments hoặc Android Studio Profiler trên release hoặc profile build. Ở đây, lần unmount đầu tiên ném `TypeError: AppState.removeEventListener is not a function`: red box trên dev build, còn trên release build một lỗi uncaught như vậy làm app sập. Leak không được sửa, và bản "sửa" còn thêm một crash.

## Đọc tín hiệu
- Ví dụ từ một lần chạy (trên máy của bạn con số sẽ khác): trước khi sửa, JS heap sau khi ép GC tăng khoảng 4 MB mỗi vòng mở và đóng, và phần so sánh snapshot cho thấy các mảng `samples` bị giữ lại qua listener của `AppState`. Khi áp bản sửa được gợi ý, lần đóng màn hình đầu tiên ném TypeError, nên bản "sửa" biến một leak thành một crash.
- Câu trả lời sai vì prompt không cho assistant dữ kiện gì để làm việc.
- Không có phiên bản. Rất nhiều ví dụ code `AppState` được viết trước RN 0.65, khi `removeEventListener` còn là cách làm chuẩn. Không có "RN 0.77", assistant không có lý do để chọn API hiện tại.
- Không có code. Nó chưa từng thấy effect, nên đoán lời khuyên React phổ biến nhất cho "performance": memoize.
- Không có bằng chứng. "Leak memory" có thể là re-render, object bị giữ lại hay bộ nhớ native. Một bộ đếm tăng theo từng vòng và một snapshot chỉ ra retainer sẽ trỏ thẳng tới subscription.
- Không có tiêu chí xong. Assistant dừng khi code trông hợp lý, vì không có gì nói cho nó biết "đã sửa" nghĩa là gì.

## Sửa
Viết prompt có dữ kiện, bằng chứng và một mục tiêu kiểm tra được. Yêu cầu giải thích nguyên nhân trước khi viết code, để lập luận sai lộ ra trước khi bạn phải đọc diff.

```text
RN 0.77, React 18.3, TypeScript, Jest with React Native Testing Library.
File: src/screens/ActivityScreen.tsx (pasted below).
Bug: memory grows on every open and close of this screen.
Evidence: after 10 open/close cycles in a release build, a counter
of live AppState listeners reads 10 with the screen closed. A heap
snapshot comparison shows the samples arrays retained by the
AppState change listeners, about 4 MB per cycle.
Constraints: no new dependencies, keep the props and the label text,
use only APIs that exist in RN 0.77.
First explain the cause. Then give the smallest fix. Then write a test
that fails before the fix and passes after it.
```

Câu trả lời giải thích rằng effect không có cleanup, nên mỗi lần mount lại thêm một listener không bao giờ bị gỡ. Bản sửa giữ subscription mà lời gọi trả về và gỡ nó trong cleanup:

```ts
useEffect(() => {
  const samples = Array.from({ length: 50_000 }, (_, i) => ({ i, userId }));
  const sub = AppState.addEventListener('change', (next) => {
    setLabel(`${next}: ${samples.length} samples`);
  });
  stats.listeners++;

  return () => {
    sub.remove();
    stats.listeners--;
  };
}, [userId]);
```

Test dùng API của RNTL v12–v13; ở RNTL v14 (React 19, RN 0.78 trở lên), `render` là async, nên viết `await render(...)`.

Test thay `AppState.addEventListener` bằng một mock trả về `{ remove }`, rồi unmount và assert rằng `remove` đã được gọi:

```ts
import { render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { ActivityScreen } from './ActivityScreen';

test('removes the AppState subscription on unmount', () => {
  const remove = jest.fn();
  const spy = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });

  const { unmount } = render(<ActivityScreen userId="u1" />);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();

  unmount();
  expect(remove).toHaveBeenCalledTimes(1);

  spy.mockRestore();
});
```

- Subscription của `NativeEventEmitter` cũng vậy: giữ giá trị `addListener` trả về và gọi `remove()` trên nó trong cleanup.
- Đừng chấp nhận `removeAllListeners` làm bản sửa. Nó gỡ luôn cả listener của các phần khác trong app.

## Đo lại
- Chạy test với code cũ trước. Nó fail ở assert cuối, vì không ai gọi `remove`. Có bản sửa thì nó pass. Một test bạn chưa từng thấy fail thì không chứng minh được gì.
- Lặp lại đúng bước kiểm tra leak như trước: cùng loại build, cùng 10 vòng, ép GC trước mỗi snapshot. `listeners` báo 0 khi màn hình đã đóng.
- Ví dụ (con số của bạn sẽ khác): mức tăng mỗi vòng giảm từ khoảng 4 MB xuống dưới 0.1 MB, và phần so sánh không còn mảng `samples` nào bị giữ lại. Trong generation của Instruments hoặc Android Studio Profiler, release build, biểu đồ là răng cưa quay về cùng một mức nền.
- Những gì bạn vẫn tự kiểm tra: `remove()` có trong type của bản RN đang cài, diff chỉ chạm vào effect này, text của label không đổi, và tìm các lời gọi `addEventListener` và `addListener` bị bỏ qua giá trị trả về. Lần tìm đó phát hiện thêm một màn hình có cùng lỗi.

## Nói trong phỏng vấn
"Chúng tôi có một màn hình mà bộ nhớ tăng sau mỗi lần mở và đóng, hai ngày trước release, và tôi dùng AI assistant để sửa nhanh hơn. Prompt đầu của tôi mơ hồ, và nó gợi ý `useCallback` cùng `AppState.removeEventListener`, một API không còn trong bản RN chúng tôi dùng; tôi bắt được nhờ đọc diff và kiểm tra type, và lần unmount đầu tiên đã crash với TypeError. Tôi viết lại prompt với phiên bản RN, component, số đo cho thấy khoảng 4 MB mỗi vòng và tiêu chí xong, rồi yêu cầu giải thích nguyên nhân trước, sau đó là bản sửa nhỏ nhất, rồi một test fail trước và pass sau khi sửa. Nó chỉ ra cleanup bị thiếu và trả về `sub.remove()` kèm một test RNTL. Tôi thấy test chuyển từ đỏ sang xanh, xác nhận mức tăng mỗi vòng đã phẳng trên release build, và tìm ra một màn thứ hai có cùng pattern. Assistant giúp tôi tiết kiệm thời gian viết code; phần kiểm chứng là của tôi."

## Liên quan
`ai-prompting-core`, `render-effects-lab`, `render-effects-core`, `ai/workflow`, `testing-components-core`
