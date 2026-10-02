---
id: maintain-regression-core
topic: maintain/regression
kind: core
readMinutes: 6
---
## TL;DR
Regression hiệu năng là loại bug không làm test nào fail. Bạn bắt được nó bằng cách đo đúng khoảnh khắc trên release build và máy thật, và đặt alert theo version. Bạn khoanh vùng nó bằng kill switch và đúng đường rollback: OTA cho thay đổi chỉ ở JS, binary mới cho mọi thứ còn lại. Bạn chặn tái phát bằng ngân sách hiệu năng trong CI và một post-mortem không đổ lỗi.

## Cơ chế bên trong
### Đo thứ người dùng cảm nhận
Debug build tải JS từ Metro, không compile bytecode trước và chạy thêm kiểm tra chỉ có khi dev, nên số đo gần như vô nghĩa. Hãy đo cold start trên release build, tính từ lúc process bắt đầu, trên máy tầm trung và máy yếu, lặp nhiều lần, rồi so median và p90. Ở production, dùng số liệu người dùng thật (trace hiệu năng, app start, slow và frozen frames) chia theo version và nhóm thiết bị. Một trace chỉ tốt bằng điểm kết thúc của nó: kết thúc khi người dùng thấy nội dung thật, không phải khi skeleton vừa layout.

### Thời gian khởi động đi đâu
Trước frame đầu tiên có: khởi tạo process, khởi tạo SDK native trong `Application` hoặc `AppDelegate`, nạp bundle, rồi mọi module chạy code ngay lúc import. Regression điển hình là một SDK mới khởi tạo đồng bộ, một thư viện bị import cả gói, và việc nặng chạy lúc nạp module. Giữ `inlineRequires` bật (mặc định trong template hiện tại), hoãn mọi thứ màn hình đầu không cần, và diff đường khởi động giữa hai bản release.

```ts
// Hoãn việc mà frame đầu tiên không cần
let index: SearchIndex | null = null;
export function getSearchIndex(): SearchIndex {
  index ??= buildSearchIndex(readCatalogSync());
  return index;
}
```

### Kích thước bundle và frame rate
Metro thông thường không tree-shake mặc định, nên một dòng import có thể thêm cả megabyte. Build bundle release với `--sourcemap-output`, xem bằng `source-map-explorer`, và cho CI fail khi vượt ngưỡng. Với hiện tượng giật, Perf Monitor hiển thị FPS của UI và của JS; UI ổn mà JS tụt nghĩa là JS thread là nút thắt. Sau khi nâng một dependency, hãy profile, rồi xác nhận trên release build.

### Bộ nhớ trong phiên dài
"Tệ dần theo thời gian, restart thì hết" nghĩa là có thứ tích tụ: listener và timer không cleanup, màn hình bị push lên stack mãi, mảng chỉ nối thêm trong store, cache không giới hạn. So sánh heap snapshot của Hermes chụp cách nhau vài phút, và kiểm tra cả bộ nhớ native, vì ảnh không nằm trong heap JS.

### Khoanh vùng và rollback
Kill switch là flag runtime lấy từ remote config, có giá trị cache, mặc định an toàn và một luồng cũ đã kiểm thử. OTA rollback được thay đổi chỉ ở JS bằng cách phát lại bundle tốt gần nhất lên đúng channel và runtime version; người dùng nhận nó ở lần kiểm tra update sau, thường là lần mở app kế tiếp. Binary thì không rollback được: dừng rollout và phát bản có version code cao hơn. Microsoft đã ngừng App Center, gồm cả CodePush, từ ngày 31/3/2025.

### Sau sự cố
Chạy post-mortem không đổ lỗi: timeline có mốc giờ, tác động bằng con số, nguyên nhân gốc và các yếu tố góp phần, và việc cần làm có người phụ trách.

## Góc phỏng vấn
- "p90 cold start tệ đi 60%, bạn làm gì?" Xác nhận bằng số liệu người dùng thật, tái hiện trên release build, diff đường khởi động, profile đúng tầng, thêm ngân sách.
- "Bạn rollback một bản release lỗi thế nào?" Flag trước, OTA nếu lỗi chỉ ở JS và runtime tương thích, nếu không thì binary mới.

## Lỗi thường gặp
- Đo hiệu năng trên debug build
- Kết thúc trace ở skeleton thay vì nội dung thật
- Việc đồng bộ nặng chạy lúc nạp module
- Listener và timer không cleanup
- Dùng flag lúc build làm kill switch
- Phát bản OTA rollback cho mọi runtime version

## Liên quan
`maintain-crash-core`, `maintain-upgrade-core`, `performance/js-thread`, `release/ota-ci`
