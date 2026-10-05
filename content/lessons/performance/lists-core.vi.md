---
id: performance-lists-core
topic: performance/lists
kind: core
readMinutes: 6
---
## TL;DR
FlatList nhanh vì nó render ít hơn, không phải vì nó render theo cách khác. Nó giữ một vùng row được mount quanh viewport và unmount phần còn lại. Phần lớn vấn đề của danh sách đến từ việc phá vùng đó, cho nó số đo sai, hoặc làm mỗi row quá nặng nên không kịp lấp vùng.

## Cơ chế bên trong
### Windowing
FlatList được xây trên `VirtualizedList`. `windowSize` tính bằng chiều cao vùng hiển thị của list: mặc định 21 nghĩa là phần đang thấy cộng tối đa 10 màn hình phía trên và 10 màn hình phía dưới. Row nằm ngoài vùng này bị unmount. `initialNumToRender` (mặc định 10) quyết định lượt render đầu, và các row đó không bao giờ bị windowing unmount. Row mới được render theo batch, mỗi batch tối đa `maxToRenderPerBatch` row (mặc định 10), với `updateCellsBatchingPeriod` là khoảng chờ giữa các batch.

Cuộn là việc của native, còn render row diễn ra trên JS thread. Khi người dùng vuốt nhanh hơn tốc độ JS thread render, bạn thấy vùng trắng. Vùng render lớn hơn hoặc batch lớn hơn che được vùng trắng, đổi lại tốn bộ nhớ và giảm độ phản hồi. Row rẻ hơn mới sửa được gốc.

### Số đo
Nếu không có gì hỗ trợ, FlatList biết vị trí của từng row qua `onLayout` sau khi row render. Nếu mọi row có kích thước biết trước, `getItemLayout` trả thẳng `{ length, offset, index }`, nên vùng render được tính mà không cần đo, và `scrollToIndex` tới được cả row chưa từng render. Con số phải khớp với thực tế, kể cả separator.

```ts
const getItemLayout = (_: unknown, index: number) => ({
  length: ROW_HEIGHT,
  offset: (ROW_HEIGHT + SEPARATOR_HEIGHT) * index,
  index,
});
```

### Key và extraData
`keyExtractor` nên trả về id ổn định từ dữ liệu. Key theo index vẫn là duy nhất nên React không cảnh báo, nhưng sau khi chèn, mọi instance hiển thị một item khác và state cục bộ của nó ở lại chỗ cũ. `extraData` báo cho FlatList render lại row khi một giá trị nằm ngoài `data` mà `renderItem` đọc thay đổi, ví dụ id đang được chọn.

### Phân trang
`onEndReachedThreshold` cũng tính bằng chiều cao vùng hiển thị: 0.5 là cách cuối nội dung nửa màn hình. `onEndReached` có thể chạy ngay lúc mount khi trang đầu ngắn, và chạy lại sau mỗi lần nội dung đổi, nên hãy chặn bằng một ref và kiểm tra `hasMore`.

### FlashList
FlashList tái sử dụng cell: row ra khỏi màn hình được giao item mới thay vì bị unmount. Cách này nhanh hơn, nhưng state cục bộ đi theo cell, nên hãy đưa nó lên cha theo id hoặc reset khi item đổi. FlashList v2 cần New Architecture và không còn yêu cầu `estimatedItemSize`.

### Đo đạc
Chỉ đánh giá hiệu năng trên release build. Dev build chạy thêm kiểm tra và cho số liệu sai lệch. Dùng perf monitor để phân biệt JS FPS với UI FPS, React DevTools Profiler để xem row nào render và vì sao, và Flashlight trên Android để có điểm số lặp lại được.

## Góc phỏng vấn
- "Vì sao `ScrollView` kèm `map` chậm với 1.000 item?" Nó mount mọi row ngay từ đầu; FlatList chỉ mount một vùng.
- "Bạn sửa vùng trắng khi cuộn nhanh thế nào?" Làm row rẻ hơn trước, rồi mới chỉnh `windowSize` và `maxToRenderPerBatch`, và giải thích được cái giá về bộ nhớ và độ phản hồi.
- "Khi nào bạn chọn FlashList?" Khi số đo cho thấy FlatList là nút thắt ở danh sách dài, và bạn đã rà state cục bộ trong row.

## Lỗi thường gặp
- Lồng FlatList trong `ScrollView` cùng chiều, khiến mọi row đều render; hãy dùng `ListHeaderComponent`
- Key theo index ở danh sách có chèn hoặc đổi thứ tự item
- `getItemLayout` bỏ qua separator hoặc header, nên `scrollToIndex` lệch dần
- Tải cùng một trang hai lần vì `onEndReached` không được chặn
- Ảnh độ phân giải đầy đủ trong row nhỏ, làm cạn bộ nhớ trên máy Android cấu hình thấp
- Bật `removeClippedSubviews` mà không test, vì tài liệu cảnh báo nó có thể làm mất nội dung

## Liên quan
`render-memo-core`, `performance/js-thread`, `visible-range`
