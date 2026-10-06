---
id: ai-workflow-core
topic: ai/workflow
kind: core
readMinutes: 5
---
## TL;DR
AI assistant giúp đọc code, viết nháp và sửa lặp lại nhanh hơn, nhưng nó không biết codebase, phiên bản bạn đã cài hay quy tắc sản phẩm, trừ khi bạn đưa cho nó. Output của nó là bản nháp. Ai commit code thì người đó chịu trách nhiệm: bạn đọc diff, chạy test, và đối chiếu mọi API lạ với docs của đúng bản RN bạn đang ship.

## Cơ chế bên trong
### AI giúp được gì trong việc RN
- Đọc code lạ: nhờ nó giải thích một native module hay một luồng saga, rồi tự đọc đoạn code nó chỉ ra để xác nhận.
- Debug: đưa stack đã symbolicate, phiên bản và thứ vừa thay đổi, rồi coi câu trả lời là danh sách giả thuyết cần tái hiện, không phải kết luận.
- Test: bảo nó liệt kê các case trước, rồi mới viết test. Đối chiếu giá trị mong đợi với yêu cầu, và cố ý làm hỏng code để thấy test fail.
- Migration và nâng cấp: tự chuyển một ví dụ làm mẫu, rồi để nó áp dụng theo từng batch nhỏ, review được. Đưa cho nó changelog và diff của Upgrade Helper.
- Review và tài liệu: một lượt soát thêm các edge case bị sót, hoặc bản nháp mô tả PR mà bạn sửa lại.

### Vì sao nó sai
Model dự đoán đoạn code nghe hợp lý theo mẫu đã học. Nó không chạy compiler hay đọc `node_modules` của bạn, trừ khi các file đó nằm trong context, nên nó có thể bịa prop, trộn API của thư viện này sang thư viện khác (`estimatedItemSize` trên `FlatList`), hoặc dùng một API đã rời core từ lâu (`AsyncStorage` từ `react-native`). Dữ liệu huấn luyện có mốc thời gian, và code RN cũ chiếm phần lớn, nên với bản RN mới nó chỉ đoán. Khi sai, giọng nó vẫn tự tin như khi đúng.

### Kiểm chứng thế nào
- Đọc toàn bộ diff như đọc PR của đồng nghiệp.
- Để TypeScript và type definition trong `node_modules` quyết định một API có tồn tại không. Lúc chạy, RN bỏ qua prop lạ một cách lặng lẽ.
- Chạy test và lint, rồi thử các màn bị ảnh hưởng trên cả hai nền tảng, trên release build nếu lỗi chỉ có ở release.
- Hành vi nào phụ thuộc phiên bản thì đối chiếu với docs của đúng phiên bản trong `package.json`.

### Dữ liệu, secret và license
Thứ gì dán vào công cụ bên ngoài là đã rời khỏi tầm kiểm soát của bạn. Xoá token, key và dữ liệu cá nhân khỏi log, và làm theo quy định của công ty về công cụ nào được xem code nào. Secret nằm trong app thì không bao giờ an toàn: biến `EXPO_PUBLIC_` và các biến môi trường lúc build đều bị inline vào bundle. Code sinh ra cũng có thể gần giống code có license, nên một đoạn dài và cụ thể bất thường cần được xem như code chép từ mạng và kiểm tra nguồn gốc.

### Khi nào không dùng
Bỏ qua AI khi quy định không cho gửi đoạn code đó ra ngoài, khi bạn không tự đánh giá được câu trả lời đúng hay sai, hoặc khi một codemod hay một lần sửa tay hai phút đáng tin hơn.

## Góc phỏng vấn
- "Kể một lần bạn dùng AI để..." Nêu bối cảnh, bạn đưa gì cho nó, cách kiểm chứng output, một lỗi bạn bắt được, và kết quả.
- Nói trung thực phần nào AI làm, phần nào bạn làm. Người phỏng vấn tìm khả năng phán đoán.

## Lỗi thường gặp
- Chấp nhận một prop hay API vì app chạy không báo lỗi
- Test chép output hiện tại vào `expect` và khoá luôn bug
- Tin bản tóm tắt changelog của AI mà không đọc changelog
- Dán log có token hoặc dữ liệu người dùng vào công cụ bên ngoài
- Nói "AI viết đấy" khi review hoặc khi phỏng vấn

## Liên quan
`ai/prompting`, `maintain-upgrade-core`, `maintain-crash-core`, `performance-lists-core`
