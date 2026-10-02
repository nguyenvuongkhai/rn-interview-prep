## Đề bài
Viết `groupCrashes(reports, { ignorePrefixes, topN })`. Mỗi report có `id`, `timestamp` và `frames`, là stack tính từ trên xuống (từ chỗ crash). Gom các report có stack cùng fingerprint, và trả về mỗi fingerprint một nhóm: `{ fingerprint, count, firstSeen, lastSeen, reportIds }`.

Export thêm `normaliseFrame(frame)` để chuyển một frame thô về dạng ổn định.

## Vì sao hay bị hỏi
Cùng một bug trông khác nhau ở mỗi bản build: số dòng và cột thay đổi, URL bundle mang hash mới, frame native mang địa chỉ mới. Không normalise thì một bug thành năm mươi issue, và đợt tăng vọt sau một bản release chìm trong nhiễu. Interviewer thường hỏi tiếp: vì sao lấy fingerprint từ các frame của app thay vì frame trên cùng?

## Ví dụ
```ts
normaliseFrame('at renderCart (index.android.bundle?hash=9f2c:1:20431)');
// 'renderCart (index.android.bundle)'

groupCrashes(reports, { ignorePrefixes: ['com.facebook.', 'java.', 'node_modules/'], topN: 2 });
// [{ fingerprint: 'com.shop.pay.Gateway.send(Gateway.kt)\ncom.shop.pay.PayModule.charge(PayModule.kt)',
//    count: 2, firstSeen: 10, lastSeen: 20, reportIds: ['a1', 'a2'] }, ...]
```

## Quy ước
- `normaliseFrame` làm lần lượt các bước sau: trim; bỏ `at ` ở đầu; xoá mọi địa chỉ hex (`0x` theo sau là chữ số hex, không phân biệt hoa thường); xoá mọi dấu `?` cùng phần theo sau nó cho tới dấu `:` hoặc `)` kế tiếp; xoá mọi chuỗi `:<chữ số>` nằm ngay trước `)` hoặc cuối chuỗi; gộp các khoảng trắng liên tiếp thành một dấu cách rồi trim lại.
- Một frame có dạng `symbol (location)`, `symbol(location)` hoặc chỉ `symbol`. Sau khi normalise, frame là của thư viện khi symbol (phần trước dấu `(` đầu tiên, đã trim) hoặc location (phần bên trong ngoặc) bắt đầu bằng một prefix trong `ignorePrefixes`.
- Bỏ các frame rỗng sau khi normalise. Fingerprint là `topN` frame đầu tiên của app, nối bằng `\n`. Nếu report không còn frame nào của app, dùng `topN` frame đầu tiên đã normalise. Report không có frame nào có fingerprint là `''`.
- `firstSeen` và `lastSeen` là timestamp nhỏ nhất và lớn nhất trong nhóm; report có thể tới theo thứ tự bất kỳ. `reportIds` giữ thứ tự đầu vào.
- Sắp xếp nhóm theo `count` giảm dần, rồi `firstSeen` tăng dần, rồi `fingerprint` tăng dần.
- Phải xử lý 20.000 report trong chưa tới một giây.
