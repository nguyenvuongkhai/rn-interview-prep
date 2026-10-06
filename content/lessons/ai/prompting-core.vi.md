---
id: ai-prompting-core
topic: ai/prompting
kind: core
readMinutes: 6
---
## TL;DR
AI assistant chỉ biết những gì bạn đưa vào prompt và những gì nó tự đoán. Một prompt tốt cho việc lập trình đưa đủ dữ kiện (phiên bản, các file liên quan, nguyên văn lỗi, ràng buộc), nói rõ kết quả mong muốn và tiêu chí "xong" kiểm tra được, và giữ việc đủ nhỏ để review. Khi output sai, hãy quay lại với lỗi cụ thể thay vì chấp nhận nó hay làm lại từ đầu. Kiểm chứng kết quả vẫn là việc của bạn.

## Cơ chế bên trong
### Ngữ cảnh mà assistant không đoán được
- Phiên bản. Hành vi và API đổi giữa các bản: RN 0.76 và 0.77 vẫn đi kèm React 18.3, nên bản sửa dùng `useEffectEvent` (React 19.2) không chạy được ở đó. Hãy ghi "RN 0.77, React 18.3", đừng ghi "mới nhất".
- Các file liên quan, do bạn chọn. Đưa cả repo làm phần quan trọng bị chìm.
- Nguyên văn lỗi, stack đã symbolicate và log có timestamp. Bằng chứng từ sai bản build, như một warning của debug cho một crash chỉ có ở release, dẫn assistant đi sai hướng.
- Ràng buộc: "không thêm dependency", "giữ API public của `useCart`", "không tắt Hermes".
- Không bao giờ đưa secret. Thay key và token thật bằng giá trị giả cùng định dạng.

### Kết quả mong muốn và tiêu chí xong
"Làm cho code sạch" thì không kiểm tra được. "Xong khi test cũ pass, có test mới cho `qty` bằng 0 và export không đổi" thì kiểm tra được. Assistant dùng nó để biết khi nào dừng; bạn dùng nó để chấm kết quả.

### Chia nhỏ
Với việc lớn, nhờ assistant lập kế hoạch trước và review kế hoạch đó. Làm một màn hoặc một module, review, rồi dùng nó làm mẫu cho phần còn lại. Mỗi bước kết thúc khi test xanh và diff đủ nhỏ để đọc. Đừng gộp việc dọn code vào một bản sửa bug.

### Test, giải thích và ví dụ
Yêu cầu một test fail trước khi sửa và pass sau khi sửa, và yêu cầu giải thích nguyên nhân trước khi đưa code. Nó làm lộ suy luận sai từ sớm. Muốn đúng phong cách của team, hãy dán một file thật làm mẫu thay vì mô tả bằng lời.

### Lặp lại với lỗi cụ thể
Khi bản sửa fail, hãy dán test fail, output của nó và input gây lỗi, rồi hỏi vì sao bản sửa trước vẫn để lọt. "Thử lại đi" hay mở phiên mới đều bỏ mất đúng dữ kiện bạn vừa có.

### Prompt để review và để debug
- Review: đưa diff kèm các file mà diff phụ thuộc vào, mục đích của thay đổi, các rủi ro cần soi, và yêu cầu nhận xét theo mức nghiêm trọng, có dòng cụ thể và kịch bản gây lỗi. Kiểm chứng từng nhận xét, vì sẽ có cái sai.
- Debug: nhờ assistant đưa giả thuyết theo thứ tự khả năng và cách xác nhận từng cái, trước khi viết code.

### Khi prompt thiếu thông tin
Nếu bạn biết còn một quyết định chưa chốt, hãy nói ra, và nhờ assistant hỏi lại hoặc liệt kê các giả định trước khi viết code.

```text
Trước:
The cart adds items twice sometimes, fix it.

Sau:
RN 0.79, React 19, Redux Toolkit 2. File: CartButton.tsx (below).
Bug: two fast taps on "Add" add the item twice.
Constraints: no new dependencies, keep the props of CartButton.
Done when: a test with two fast presses sees one request,
and the existing cart tests pass. Explain the cause first.
```

## Góc phỏng vấn
- "Kể một lần bạn dùng AI để debug." Nói rõ bối cảnh, prompt, cách bạn kiểm chứng câu trả lời và kết quả.
- "Assistant trả lời sai thì bạn làm gì?" Cho thấy bạn lặp lại với lỗi cụ thể, và biết lúc nào nên dừng để tự đọc docs.

## Lỗi thường gặp
- Ghi "mới nhất" thay vì phiên bản thật
- Dán cả repo, hoặc dán secret thật
- Mục tiêu mơ hồ như "sạch" hay "best practice"
- Đòi viết lại toàn bộ trong một bản sửa bug
- Bảo "thử lại" mà không đưa ca bị lỗi
- Skip test fail để kết quả trông có vẻ xanh
- Để assistant âm thầm quyết một câu hỏi sản phẩm còn bỏ ngỏ

## Liên quan
`ai/workflow`, `maintain-crash-core`, `testing/unit`, `debug/js`
