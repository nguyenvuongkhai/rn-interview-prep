---
id: testing-unit-core
topic: testing/unit
kind: core
readMinutes: 6
---
## TL;DR
Một unit test chỉ tốt khi nó có assertion sẽ fail nếu code hỏng. Phần lớn test tồi không fail ầm ĩ; chúng pass trong khi code đang hỏng: assertion không được `await`, matcher kiểm ít hơn bạn nghĩ, hoặc state còn sót lại từ test trước. Hãy test trực tiếp logic thuần (reducer, selector, helper), chỉ mock ở ranh giới, điều khiển thời gian bằng fake timer, và để mỗi test tự dựng state của nó.

## Cơ chế bên trong
### Cấu trúc và matcher
`describe` gom nhóm test, `it` (hoặc `test`) khai báo một test, `expect` dùng để assert. Trong một file, Jest chạy test lần lượt theo thứ tự; song song chỉ diễn ra giữa các file, và mỗi file có module registry riêng.
- `toBe` dùng `Object.is`, nên với object nó kiểm tham chiếu. `toEqual` so đệ quy theo giá trị và bỏ qua property có giá trị `undefined`; `toStrictEqual` thì không bỏ qua.
- `toThrow` cần một hàm: `expect(() => parse('')).toThrow()`.
- `toHaveBeenCalledWith` pass nếu bất kỳ lần gọi nào đã ghi lại khớp. Dùng `toHaveBeenCalledTimes`, `toHaveBeenLastCalledWith` hoặc `toHaveBeenNthCalledWith` khi cần kiểm đúng một lần gọi.

### Mock
`jest.fn()` ghi mọi lần gọi vào `mock.calls`. `jest.mock('./api')` thay module trong registry, nên mọi module import nó đều nhận bản mock. babel-jest đưa `jest.mock` lên trên các import, vì vậy viết nó bên dưới import vẫn có tác dụng. Factory chỉ được tham chiếu biến bên ngoài có tiền tố `mock`, và biến đó phải được khởi tạo trước khi factory chạy.

### Bất đồng bộ
Hãy `return` hoặc `await` mọi promise mà test phụ thuộc vào. `await expect(p).resolves.toBe(x)` và `await expect(p).rejects.toThrow('msg')` đều cần `await`; thiếu nó, test kết thúc trước và pass. Test `async` không cần `done`.

### Fake timer
`jest.useFakeTimers()` thay `setTimeout`, `setInterval` và `Date`. `jest.advanceTimersByTime(ms)` chạy đồng bộ các timer đến hạn, nhưng không chờ promise, nên timer được tạo sau một `await` lúc đó chưa tồn tại. Với code trộn promise và timer, dùng `await jest.advanceTimersByTimeAsync(ms)` (từ Jest 29.5), và dùng `jest.setSystemTime` để cố định `Date.now()`.

```ts
it('debounces search', () => {
  jest.useFakeTimers();
  const search = jest.fn();
  const onChange = debounce(search, 300);
  onChange('a');
  onChange('ab');
  jest.advanceTimersByTime(300);
  expect(search).toHaveBeenCalledTimes(1);
  expect(search).toHaveBeenLastCalledWith('ab');
});
```

### Logic thuần
Reducer và selector không cần mock: đưa input vào, kiểm output ra. `Object.freeze` state đầu vào để reducer nào sửa trực tiếp sẽ làm test fail. Với selector có memoize, gọi hai lần với cùng state và assert bằng `toBe`.

### Coverage
Coverage cho biết dòng và nhánh nào đã chạy, không cho biết hành vi nào đã được kiểm. Một test không có assertion vẫn tạo coverage. Dùng nó để tìm code chưa test, và xem branch coverage thay vì line coverage.

## Góc phỏng vấn
- "Test pass nhưng tính năng vẫn hỏng. Vì sao?" Thiếu `await`, `toHaveBeenCalledWith` khớp với một lần gọi trước đó, assert trong vòng lặp trên mảng rỗng, hoặc `it.only` làm phần còn lại của file bị bỏ qua.
- "Test chỉ fail trên CI hoặc chỉ fail khi chạy riêng." Phụ thuộc thứ tự: state dùng chung ở cấp module, mock không được reset, thời gian thật.

## Lỗi thường gặp
- Assert `resolves` hoặc `rejects` mà không `await`
- Test `try`/`catch` không có `expect.assertions`
- Dùng `toBe` với object do code đang test tạo ra
- Sửa trực tiếp fixture dùng chung, làm test phụ thuộc thứ tự
- Không reset mock; hãy bật `clearMocks` hoặc `restoreMocks` trong cấu hình
- Gọi `advanceTimersByTime` trước khi code kịp tạo timer
- Coi con số coverage là bằng chứng code đúng

## Liên quan
`testing/components`, `testing-e2e-core`, `state-redux-core`, `state-async-core`
