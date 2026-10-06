# Lab — kiểm chứng tối ưu và tìm lỗi bằng công cụ thật

Ngày: 2026-10-06. Bổ sung cho spec gốc `2026-09-30-rn-interview-prep-design.md`.

## 1. Mục tiêu

Câu hỏi phỏng vấn thường đi theo cặp: "bạn sẽ làm gì?" rồi "làm sao bạn biết nó đã hiệu quả?". Nội dung hiện tại trả lời tốt vế đầu nhưng chưa dạy vế sau. Lab lấp chỗ đó: mỗi lab là một ca thật, đi từ triệu chứng tới con số chứng minh bản sửa có tác dụng.

Người học chưa có nhiều kinh nghiệm với các khái niệm lớn (re-render, memory leak, JS thread), nên mỗi lab phải có code chạy được, các bước bấm cụ thể trong công cụ, và giải thích tín hiệu đọc được nghĩa là gì.

Hai kỹ năng đi kèm cũng còn thiếu: viết test để chứng minh bản sửa, và debug để tìm nguyên nhân. Vì vậy P7 thêm hai nhóm chủ đề mới, `testing` và `debug` (§4), mỗi nhóm có câu hỏi, bài học và lab.

Interviewer giờ cũng hay hỏi "bạn dùng AI assistant thế nào trong công việc?" và muốn nghe ca thật. P7 thêm nhóm thứ ba, `ai` (§4), dạy cách làm việc với AI assistant và cách viết prompt, kèm một lab.

### Ngoài phạm vi
- Chạy code của lab trong trình duyệt. React Native không chạy được ở đó; lab là hướng dẫn để làm trên app của người học.
- Ảnh chụp màn hình hay video: renderer Markdown không hỗ trợ ảnh.
- Mock interview (P6) đang tạm dừng và không liên quan tới phần này.

## 2. Lab là gì

Lab là một bài học với `kind: 'lab'`, nằm cùng chỗ với bài học thường: `content/lessons/<root>/<slug>-lab.{vi,en}.md`, lesson id `<root>-<slug>-lab`. Nhờ vậy lab tự hiện ở Thư viện dưới chủ đề của nó.

### Khung cố định

| Tiếng Việt | Tiếng Anh | Nội dung |
|---|---|---|
| `# <tiêu đề>` | `# <title>` | Dòng đầu tiên của bài, ví dụ "Lab: chứng minh memo có tác dụng" |
| `## Tình huống` | `## The case` | Triệu chứng thật, ví dụ "feed bị giật", "mở trang hồ sơ nhiều lần thì RAM cứ tăng" |
| `## Dựng lại lỗi` | `## Reproduce it` | Code lỗi (TSX), đủ nhỏ để dán vào một app thử |
| `## Đo` | `## Measure` | Các bước trong công cụ, bấm gì ở đâu, đo trên release hoặc profile build |
| `## Đọc tín hiệu` | `## Read the signal` | Bạn sẽ thấy gì, nó nghĩa là gì, kèm con số ví dụ |
| `## Sửa` | `## Fix` | Code đã sửa |
| `## Đo lại` | `## Measure again` | So sánh trước và sau, và điều gì chứng minh bản sửa có tác dụng |
| `## Nói trong phỏng vấn` | `## Say it in the interview` | Một câu trả lời ngắn kiểu "tôi đã chứng minh nó như thế nào" |
| `## Liên quan` | `## Related` | Bài học, câu hỏi và lab liên quan |

- Độ dài 700–1200 từ mỗi bản, `readMinutes` từ 8 tới 15.
- Các bước dùng bullet `-`, không dùng danh sách đánh số (parser không hỗ trợ).
- Con số trong "Đọc tín hiệu" và "Đo lại" là ví dụ minh hoạ; phải ghi rõ là ví dụ, và nói người học sẽ thấy con số khác trên máy của họ.

## 3. Bảy lab đầu tiên

| Lab id | Chủ đề | Ca thật | Công cụ |
|---|---|---|---|
| `render-memo-lab` | `render/memo` | Danh sách sản phẩm re-render toàn bộ khi gõ vào ô tìm kiếm; thêm một selector Redux trả về object mới mỗi lần | React DevTools Profiler (lý do render, thời gian commit, "Highlight updates when components render"), component `<Profiler onRender>` của React để đếm render bằng code |
| `render-effects-lab` | `render/effects` | Mở rồi đóng một màn nhiều lần thì bộ nhớ tăng mãi: listener không được gỡ, interval không bị xoá, closure giữ dữ liệu lớn | Heap snapshot trong React Native DevTools (Hermes) và so sánh hai snapshot, Xcode Instruments (Allocations, Leaks), Android Studio Memory Profiler, LeakCanary cho phần native Android |
| `performance-lists-lab` | `performance/lists` | Feed dài bị giật và hiện khoảng trắng khi cuộn nhanh | Perf Monitor (JS FPS, UI FPS), Flashlight trên Android, đo khoảng trắng; so trước và sau khi dùng `getItemLayout`, chỉnh `windowSize`, hoặc chuyển sang FlashList |
| `performance-js-thread-lab` | `performance/js-thread` | Nút bấm không phản hồi trong vài giây sau khi mở app, và app khởi động chậm | Hermes sampling profiler (flame chart trong React Native DevTools), tìm long task, đo thời gian tới lúc tương tác được; chuyển việc nặng ra sau tương tác đầu tiên và chứng minh bằng số |

Các câu `open` (và câu `spot-bug` liên quan) của mỗi chủ đề thêm lab id vào mảng `lessons`.

### Độ chính xác
- Không bịa menu, nút hay flag của công cụ. Bước nào phụ thuộc phiên bản thì ghi rõ phiên bản, ví dụ "React Native DevTools là debugger mặc định từ RN 0.76".
- Luôn đo trên release hoặc profile build; dev build chậm hơn nhiều và cho kết luận sai.
- Không chắc một chi tiết giao diện thì mô tả theo chức năng ("mở tab Memory, chụp heap snapshot") thay vì đường dẫn menu chính xác.

## 4. Ba nhóm chủ đề mới: testing, debug và ai

Thêm vào `content/topics.json`, mỗi chủ đề 12 câu và một bài `core`, theo đúng cơ cấu trong content guide:

| Chủ đề | Tên (vi / en) | Nội dung chính |
|---|---|---|
| `testing/unit` | Unit test với Jest / Unit testing with Jest | cấu trúc test, `expect` và matcher, mock module và hàm (`jest.fn`, `jest.mock`), fake timers, test code async, test reducer và selector, coverage nói lên gì và không nói lên gì |
| `testing/components` | Test component với RNTL / Component tests with RNTL | React Native Testing Library: query theo vai trò và text, `userEvent`/`fireEvent`, `findBy` cho UI async, mock native module và navigation, tránh test chi tiết cài đặt |
| `testing/e2e` | E2E test và chiến lược test / E2E tests and test strategy | Detox và Maestro ở mức khái niệm, test pyramid, test gì ở tầng nào, test bị flaky và cách xử lý, chạy test trong CI |
| `debug/js` | Debug phía JS / Debugging JavaScript | React Native DevTools (breakpoint, console, tab Network và Memory theo phiên bản), React DevTools, đọc red box và LogBox, log có cấu trúc, tái hiện lỗi |
| `debug/native` | Debug phía native / Debugging native code | `adb logcat`, Console.app và Xcode console, đọc native crash và stack, debug build release, lỗi chỉ xảy ra trên một loại máy |

| `ai/workflow` | Làm việc với AI assistant / Working with AI assistants | dùng AI ở đâu trong quy trình (đọc code lạ, debug, viết test, migrate, review), kiểm chứng output (đọc diff, chạy test, đối chiếu docs), rủi ro thật (API bịa, kiến thức cũ so với phiên bản RN đang dùng, lộ secret và code nội bộ, license), khi nào không nên dùng, trách nhiệm của người commit |
| `ai/prompting` | Viết prompt cho việc lập trình / Prompting for coding work | đưa đủ ngữ cảnh (phiên bản, file, lỗi, log, ràng buộc), nói rõ kết quả mong muốn và tiêu chí xong, chia việc lớn thành bước, yêu cầu test và giải thích, cho ví dụ, lặp lại khi output sai thay vì chấp nhận, prompt để review và để debug |

Nhóm `testing` có weight 3 cho `unit` và `components`, 2 cho `e2e`; nhóm `debug` weight 3 cho `js`, 2 cho `native`; nhóm `ai` weight 2 cho cả hai chủ đề.

Nội dung nhóm `ai` viết theo cách làm, không gắn với một sản phẩm cụ thể (Copilot, Cursor, Claude Code…), vì tính năng của các công cụ đổi rất nhanh. Câu `open` của nhóm này viết như interviewer hỏi "kể một lần bạn dùng AI để…", và `modelAnswer` là một ca thật có bối cảnh, prompt, cách kiểm chứng và kết quả.

Challenge chạy được trong trình duyệt vì chỉ là TypeScript thuần, nên thêm một challenge cho testing: người học viết các test bằng harness có sẵn để bắt lỗi trong một hàm cho trước. Chi tiết challenge này chốt ở plan; nếu harness hiện tại không hỗ trợ được thì bỏ challenge, không đổi harness trong P7.

Ba lab thêm vào danh sách ở §3:

| Lab id | Chủ đề | Ca thật | Công cụ |
|---|---|---|---|
| `testing-unit-lab` | `testing/unit` | Một bug thật trong reducer giỏ hàng: viết test đỏ trước, sửa, test xanh, rồi giữ test để chặn regression | Jest, `describe`/`it`/`expect`, mock, chạy một test bằng `-t`, đọc diff của assertion |
| `debug-js-lab` | `debug/js` | Màn hình hiện sai dữ liệu: đi từ triệu chứng tới dòng code gây lỗi | React Native DevTools (breakpoint, call stack, scope, tab Network), React DevTools (props và state), log có request id |
| `ai-prompting-lab` | `ai/prompting` | Dùng AI assistant để sửa một memory leak trong màn hình có subscription: prompt mơ hồ cho ra bản sửa sai, prompt đủ ngữ cảnh cho ra bản sửa đúng, rồi kiểm chứng bằng test và heap snapshot | Một AI assistant bất kỳ; so sánh prompt trước và sau, cách đọc và kiểm tra diff, test chứng minh bản sửa |

Lab `ai-prompting-lab` dùng khung chung ở §2, với nghĩa: "Dựng lại lỗi" gồm code lỗi và prompt mơ hồ, "Đo" là kiểm tra output của AI, "Sửa" là prompt tốt hơn cùng bản sửa, "Đo lại" là test và heap snapshot.

## 5. Thay đổi code

1. **Schema:** thêm `'lab'` vào `kind` (`src/core/schema.ts`). Item không bao giờ dùng `kind: 'lab'`; integrity check báo lỗi nếu item dùng nó.
2. **Chuỗi:** thêm `kind_lab` ("Lab" / "Lab") và `verifyLink` ("Cách kiểm chứng: {title}" / "How to verify: {title}").
3. **Tiêu đề bài học:** hàm thuần `lessonTitle(body)` trả về nội dung dòng `# …` đầu tiên nếu có. Màn Lesson dùng tiêu đề này thay cho tên chủ đề, và không render lại dòng H1 đó trong thân bài. Link ở Thư viện hiện tiêu đề lab thay cho "Bài học: Lab · 12 phút".
4. **Link cạnh đáp án mẫu:** ở mọi chỗ đáp án mẫu của câu `open` hiện ra (`OpenView` khi bấm hiện đáp án, `ReviewItem` ở màn Result), các lab nằm trong `lessons` của câu đó hiện thành link "Cách kiểm chứng: <tiêu đề>".
5. **Content guide:** thêm mục "Lab" vào `docs/content-guide.md` gồm khung, độ dài, quy tắc độ chính xác ở §3, và quy ước tên file.

## 6. Testing

Vitest, chạy bởi chủ project:
- `lessonTitle`: có H1, không có H1, H1 không ở dòng đầu.
- Integrity: item dùng `kind: 'lab'` bị báo lỗi; content thật vẫn sạch.
- Content test sẵn có (schema, đủ 2 ngôn ngữ, frontmatter khớp, tham chiếu `lessons` tồn tại) tự áp dụng cho các lab mới.

Kiểm tra tay: mở từng lab ở Thư viện, kiểm tra tiêu đề và khung; làm một câu `open` có lab, bấm hiện đáp án và thấy link.

## 7. Thứ tự triển khai

1. Code: schema, chuỗi, `lessonTitle`, Lesson, Library, link cạnh đáp án, content guide.
2. Ba nhóm chủ đề `testing`, `debug` và `ai`: topics, câu hỏi, bài học, challenge testing.
3. Bảy lab, viết song song, mỗi lab một agent; sau đó gắn lab id vào các câu liên quan.
4. Review độ chính xác của công cụ trong từng lab.
