## Đề bài
Viết `createLayout(heights)`. `heights[i]` là chiều cao đo được của dòng `i`, luôn dương. Hàm trả về:

- `totalHeight`: chiều cao của cả danh sách
- `offsetOf(index)`: vị trí y nơi dòng `index` bắt đầu
- `range(offset, viewport, windowSize)`: các dòng cần render, dạng `{ first, last }` (tính cả hai đầu), hoặc `null` khi không có dòng nào trong vùng

`range` làm theo prop `windowSize` của `FlatList`: vùng render cao `windowSize` lần viewport, lấy viewport đang hiện làm tâm. Với `windowSize` 1 bạn chỉ render phần trên màn hình; với 21 (mặc định) bạn render thêm 10 viewport phía trên và 10 phía dưới.

## Vì sao hay bị hỏi
Một feed 50.000 dòng với chiều cao khác nhau bị giật vì list render quá nhiều, hoặc hiện khoảng trắng vì render quá ít. Interviewer muốn biết `windowSize`, `getItemLayout` và việc đo cell thật sự làm gì. `range` chạy ở mỗi event scroll, nên không được duyệt cả danh sách mỗi lần.

## Ví dụ
```ts
const layout = createLayout([100, 100, 100, 100, 100]);
layout.offsetOf(3);                  // 300
layout.range(120, 150, 1);           // { first: 1, last: 2 }
```

## Quy ước
- Một dòng nằm trong vùng khi nó chồng lên vùng. Dòng chỉ chạm mép vùng thì không tính.
- `offset` có thể âm (iOS bounce) hoặc vượt quá cuối danh sách. Kẹp vùng vào `[0, totalHeight]`.
- Danh sách rỗng có `totalHeight` bằng 0, và `range` trả về `null`.
- Làm phần việc tuyến tính một lần trong `createLayout`. Mỗi lần gọi `range` phải nhanh hơn việc duyệt qua mọi dòng.
