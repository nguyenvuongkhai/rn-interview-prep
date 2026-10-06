---
id: testing-components-core
topic: testing/components
kind: core
readMinutes: 6
---
## TL;DR
React Native Testing Library (RNTL) render component trong Jest và cho bạn query, tương tác với nó như người dùng. Query theo role, label và text trước khi dùng `testID`, tương tác bằng userEvent, và chờ thứ người dùng sẽ thấy bằng `findBy` hoặc `waitFor`. Phần lớn component test flaky hoặc dễ vỡ đến từ ba nguyên nhân: không chờ cập nhật bất đồng bộ, state dùng chung giữa các test, và assertion trên chi tiết cài đặt.

## Cơ chế bên trong
### Render và query
`render` chạy component bằng test renderer của React trong Node. Không có view native nào: các host component như `View`, `Text`, `TextInput` chỉ là element thường, bạn đọc được prop của chúng. Query chia làm ba nhóm:
- `getBy` trả về một phần tử, ném lỗi nếu không có hoặc có nhiều hơn một.
- `queryBy` trả về phần tử hoặc `null`. Dùng nó để assert sự vắng mặt.
- `findBy` trả về promise, thử lại cho tới khi phần tử xuất hiện hoặc hết timeout (mặc định 1000 ms).

Mỗi nhóm có biến thể `All` trả về mảng. Ưu tiên `getByRole('button', { name: 'Save' })`, `getByLabelText` và `getByText`: chúng khớp với thứ người dùng và screen reader nhận biết, nên kiểm tra luôn accessibility và sống sót qua refactor.

### Tương tác
`fireEvent.press` hay `fireEvent.changeText` gọi thẳng một handler prop. userEvent (RNTL v12 trở lên) mô phỏng người dùng: `user.press` chạy chuỗi press-in và press-out, còn `user.type` focus vào input, phát key press và thay đổi text cho từng ký tự rồi blur. userEvent bất đồng bộ, nên luôn `await`.

```ts
test('saves the new name', async () => {
  const user = userEvent.setup();
  render(<EditNameForm initialName="An" />);
  await user.type(screen.getByLabelText('Name'), ' Nguyen');
  await user.press(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Saved')).toBeOnTheScreen();
});
```

`toBeOnTheScreen()` là matcher có sẵn của RNTL ở các bản gần đây (từ v12.4); project cũ lấy nó từ `@testing-library/jest-native`.

Các ví dụ dùng API của RNTL v12–v13. Ở RNTL v14 (React 19 và RN 0.78 trở lên), `render`, `fireEvent` và `act` là async: viết `await render(...)` và `await fireEvent.press(...)`.

### act và bất đồng bộ
`act` bảo đảm cập nhật và effect đã được xử lý xong trước khi assertion chạy. RNTL đã bọc `render`, `fireEvent` và userEvent trong `act`. Cảnh báo "not wrapped in act(...)" nghĩa là có cập nhật xảy ra ngoài các lời gọi đó, thường là một promise resolve sau khi test đã đi tiếp. Sửa bằng cách chờ kết quả hiển thị, không phải bọc thêm `act`.

### Mock và provider
Jest chạy trong Node, nên native module phải được mock, tốt nhất bằng mock mà thư viện cung cấp, đặt trong file setup của Jest. Factory của `jest.mock` thay cả module, nên khi chỉ ghi đè một export thì spread `jest.requireActual`. Với thư viện dựa trên context, render trong provider thật qua helper `renderWithProviders`: store tạo bằng `configureStore` với reducer thật và một `QueryClient` mới với `retry: false`, cả hai tạo mới cho mỗi test. Mock ở ranh giới mạng, không mock hook của chính app. Với navigation, một `NavigationContainer` thật với stack nhỏ thường bền hơn mock hook.

## Góc phỏng vấn
- "Một component test flaky trên CI." Tái hiện bằng cách chạy lặp, tìm UI bất đồng bộ không được chờ và state dùng chung, và không chấp nhận tăng timeout làm cách sửa.
- "Một refactor làm vỡ 40 test dù người dùng không thấy gì khác." Các test đó kiểm tra cấu trúc; chuyển sang query theo role, text và assertion rõ ràng.

## Lỗi thường gặp
- Assert bằng `getBy` ngay sau thao tác bất đồng bộ thay vì `findBy`
- Quên `await` trước `waitFor` hoặc userEvent
- `QueryClient` hay store cấp module dùng chung giữa các test
- Để nguyên retry mặc định của TanStack Query trong test
- Snapshot cả màn hình và gắn `testID` cho mọi phần tử
- Che cảnh báo act thay vì chờ kết quả

## Liên quan
`testing/unit`, `testing/e2e`, `state/redux`, `state/async`
