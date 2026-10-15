---
id: perf-lists-flatlist-tuning
topic: performance/lists
kind: hard-issue
readMinutes: 6
---
## TL;DR
`FlatList` vốn đã virtualize. Giật thường đến từ **dòng render tốn kém, re-render không cần thiết, hoặc làm quá nhiều việc cùng lúc**. Vùng trắng nghĩa là dòng không render kịp tốc độ cuộn.

## Cơ chế bên trong
1. **Đo trước:** test trên **bản release** (chế độ dev cho số đo sai lệch), dùng Profiler để tìm re-render, và xem JS thread hay UI thread bị rớt frame.
2. **Làm dòng rẻ và ổn định:** bọc `React.memo` cho dòng, `renderItem` và handler ổn định, `keyExtractor` theo id, không làm việc nặng trong dòng, và **ảnh đúng kích thước, có cache** (nguyên nhân rất phổ biến).
3. **Tinh chỉnh list:** `getItemLayout` cho dòng cao cố định, `initialNumToRender`, `maxToRenderPerBatch`, `windowSize` (bộ nhớ đổi lấy ít vùng trắng).
4. **Phân trang:** `onEndReached` và `onEndReachedThreshold`, kèm cơ chế chặn tải trùng.
5. **Cân nhắc FlashList:** nó tái sử dụng view của dòng thay vì tạo mới; v2 được xây cho kiến trúc mới.

## Góc phỏng vấn
- "Bạn bắt đầu từ đâu?" Tái hiện trên bản release và profile. Không chỉnh prop một cách mò mẫm.
- "Vì sao có vùng trắng?" Render không theo kịp tốc độ cuộn. Dòng rẻ hơn hoặc `windowSize` lớn hơn sẽ giúp, đổi lại tốn bộ nhớ.
- "Khi nào dùng FlashList?" Khi dòng vẫn tốn kém sau khi đã memo, hoặc danh sách rất dài.

## Lỗi thường gặp
- Dùng ảnh độ phân giải gốc cho thumbnail nhỏ
- `renderItem` và handler inline làm `React.memo` mất tác dụng
- Coi `removeClippedSubviews` là mặc định an toàn; nó có thể làm mất nội dung trên iOS ở một số layout, nên test trước
- Tải hàng nghìn item một lúc thay vì phân trang

## Liên quan
`render/memo`, `architecture/threading`
