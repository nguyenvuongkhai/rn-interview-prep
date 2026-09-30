# RN Interview Prep — Design

- **Ngày:** 2026-09-30
- **Trạng thái:** Đã duyệt thiết kế, chờ review spec
- **Mục tiêu:** Web app cá nhân để ôn React Native cho phỏng vấn mức senior. Mỗi ngày làm một bài test → có kết quả → phân tích kiến thức còn thiếu → gợi ý cụ thể phải làm gì để bổ sung.

## 1. Phạm vi

### Trong phạm vi (giai đoạn 1: MVP, không dùng AI)
- Thư viện kiến thức theo cây chủ đề. Mỗi chủ đề có 4 loại nội dung: cốt lõi, nâng cao, lỗi thường gặp, issue khó.
- Bài test hằng ngày: chọn 15, 30 hoặc 45 phút, app tự ghép bài.
- Code editor TypeScript (Monaco), chạy code và chấm bằng test ẩn ngay trên trình duyệt.
- Phân tích lỗ hổng bằng quy tắc, cùng kế hoạch bổ sung có ước lượng thời gian.
- Nội dung song ngữ VI/EN.

### Giai đoạn 2 (tuỳ chọn, gắn sau)
- AI (Claude API) chấm câu tự luận, review code challenge, viết nhận xét tuần.
- Gọi qua một Cloudflare Worker nhỏ làm proxy, hoặc dùng API key do người dùng nhập và lưu ở trình duyệt.
- App phải chạy trọn vẹn khi không có AI.

### Ngoài phạm vi
- Nhiều người dùng, đăng nhập, backend, đồng bộ giữa các thiết bị.
- Render UI React Native trong trình duyệt. Challenge chỉ là TypeScript thuần.
- SEO.

## 2. Người dùng và triển khai
- Một người dùng duy nhất là chủ project.
- Site tĩnh, deploy lên Cloudflare Pages.
- Toàn bộ dữ liệu người dùng nằm trong IndexedDB của trình duyệt, có export/import JSON để backup.

## 3. Stack
- Vite + React + TypeScript (SPA)
- Dexie (IndexedDB), zod (schema), Monaco (`@monaco-editor/react`, lazy-load), sucrase (chuyển TS sang JS), Vitest
- Markdown cho bài học, JSON cho câu hỏi và metadata

Đã cân nhắc và loại: Astro (phần chính là "app" chứ không phải site đọc) và Next.js static export (thừa khi không có server).

## 4. Kiến trúc

```
rn-interview-prep/
├── content/
│   ├── topics.json
│   ├── lessons/<topic>/<id>.vi.md, <id>.en.md
│   ├── questions/<topic>.json
│   └── challenges/<id>/{meta.json, prompt.vi.md, prompt.en.md, starter.ts, tests.ts, solution.ts}
├── src/
│   ├── core/        # hàm thuần TS, không phụ thuộc React hay storage
│   │   ├── schema.ts
│   │   ├── sessionBuilder.ts
│   │   ├── grading.ts
│   │   ├── mastery.ts
│   │   ├── scheduler.ts
│   │   └── recommend.ts
│   ├── runner/      # Web Worker + test harness
│   ├── storage/     # Dexie, export/import, migration
│   ├── screens/     # Today, Test, Result, Library, Lesson, Challenge, Progress, Settings
│   └── components/
└── ai/              # giai đoạn 2
```

**Nguyên tắc:**
- Content tách khỏi code. Thêm câu hỏi chỉ là sửa file content. Content sai schema làm build fail.
- `core/` chỉ gồm hàm thuần: nhận dữ liệu, trả kết quả.
- `storage/` là nơi duy nhất đụng tới IndexedDB.
- Độ thành thạo (mastery) **không được lưu**: luôn tính lại từ lịch sử trả lời (attempts).

**Luồng chính:** Today (chọn thời lượng) → Test → Result (điểm, lỗ hổng, kế hoạch) → Lesson / Challenge. Progress là màn tổng quan.

## 5. Cây chủ đề

Khung lấy theo *cấu trúc* roadmap React Native của roadmap.sh (chỉ lấy khung, nội dung tự viết):
Environment/Expo/Metro, Debugging, Core Components, Listings, Platform-specific, Styling/Flexbox, Networking, Interactions/Animations/Navigation, Security/Storage, Testing, Performance, Native Modules, Publishing.

Thêm các nhánh cho mức senior:
- **Kiến trúc mới:** JSI, Fabric, TurboModules, Codegen, Bridgeless, so sánh với bridge cũ
- **Runtime:** Hermes, threading model (JS/UI/background), bytecode, GC
- **Render sâu:** reconciliation, re-render, `memo`/`useCallback`, concurrent React 18/19
- **State & data:** state management, offline-first, cache/sync, race condition
- **Production:** OTA update, CI/CD, crash reporting/symbolication, kích thước app, memory leak
- **Mobile system design**

Mỗi node trong `topics.json` gồm: `id`, `title {vi,en}`, `parent`, `weight` (1–3, mức độ hay bị hỏi khi phỏng vấn), `group` (nhóm lớn dùng cho "mức sẵn sàng phỏng vấn").

## 6. Mô hình nội dung

### Trường chung cho mọi item
| Trường | Kiểu | Ghi chú |
|---|---|---|
| `id` | string | duy nhất trong toàn bộ content |
| `topics` | string[] | phần tử đầu là chủ đề chính, thêm tối đa 2 chủ đề phụ |
| `kind` | `core \| advanced \| pitfall \| hard-issue` | |
| `difficulty` | `1 \| 2 \| 3` | 1 = mid, 2 = senior, 3 = staff |
| `estSeconds` | number | dùng để ghép bài theo thời lượng |
| `lessons` | string[] | id các bài học liên quan |

Mọi đoạn text đều có dạng `{ "vi": string, "en": string }` và bắt buộc có đủ cả hai.

### Loại câu hỏi
- **`mcq`:** `prompt`, `options[]`, `answer: number[]`, `multi: boolean`, `explanation`. Mỗi đáp án sai có thể có `misconception { id, text }`.
- **`spot-bug`:** `code`, `answerLine`, `causeOptions[]`, `answerCause`, `explanation`, và `misconception` theo từng đáp án nguyên nhân.
- **`open`:** `prompt`, `keyPoints[]`, `modelAnswer`, `followUps[]`.
- **`challenge`:** thư mục riêng. `meta.json` gồm các trường chung và `hints[]`. `tests.ts` gắn `category` cho từng test (ví dụ `basic`, `edge-case`, `async-order`, `perf`) và cờ `hidden`.

### Bài học
Frontmatter gồm `id`, `topic`, `kind`, `readMinutes`. Thân bài theo khung cố định: **TL;DR → Cơ chế bên trong → Góc phỏng vấn (câu follow-up) → Lỗi thường gặp → Liên quan.**

### Khối lượng nội dung MVP
Khoảng 12 chủ đề, khoảng 160 câu hỏi, khoảng 15 challenge, khoảng 25 bài học. Viết mẫu **một chủ đề hoàn chỉnh** trước để chốt giọng văn và độ sâu, sau đó mới soạn hàng loạt (Claude soạn nháp, chủ project duyệt).

## 7. Chấm điểm (`grading.ts`)
- **`mcq`:** chọn đúng hết thì 1, còn lại 0.
- **`spot-bug`:** đúng dòng được 0.5, đúng nguyên nhân được 0.5.
- **`challenge`:** số test pass / tổng số test, mỗi hint đã mở trừ 0.1, điểm thấp nhất là 0.
- **`open`:** số ý đạt / tổng số `keyPoints`. Người dùng tự tick (AI chấm ở giai đoạn 2).

## 8. Engine ghép bài hằng ngày (`sessionBuilder.ts`)

**Đầu vào:** `durationMin` (15/30/45), ngân hàng câu hỏi, attempts, lịch ôn lại, `date`.

**Cơ cấu mục tiêu:**
| | mcq + spot-bug | open | challenge |
|---|---|---|---|
| 15' | khoảng 8 | 0 | 1 (≤5') |
| 30' | khoảng 10 | 1 | 1 (vừa) |
| 45' | khoảng 12 | 1 | 2 (vừa + khó) |

**4 nhóm ưu tiên**, lấp dần cho tới khi đủ thời lượng (cho phép lệch ±10%):
1. Câu đến hạn ôn lại: tối đa 30%
2. Chủ đề yếu (mastery thấp nhất): khoảng 40%
3. Chủ đề chưa đụng tới: khoảng 20%
4. Câu vượt sức (khó hơn trình độ hiện tại một bậc): khoảng 10%

Khi chưa có dữ liệu, dồn phần của nhóm 1 và nhóm 2 sang nhóm 3.

**Quy tắc:**
- Seed là hàm của `date`, nên cùng một ngày luôn ra cùng một bài Daily.
- Mỗi ngày có một bài Daily tính vào streak. Luyện thêm không giới hạn, lưu với `mode: "practice"`.
- Lưu sau mỗi câu trả lời, nên có thể làm tiếp nếu lỡ đóng tab.
- Đồng hồ là giới hạn mềm, thời gian quá giờ được ghi lại.
- Sau mỗi câu, người dùng chọn mức tự tin: `guess | fairly | sure`.

## 9. Lặp lại ngắt quãng (`scheduler.ts`)
Kiểu Leitner:
- Sai: ôn lại sau 1 ngày.
- Đúng nhưng `guess`: sau 3 ngày.
- Đúng liên tiếp: khoảng cách giãn dần 3 → 7 → 21 → 60 ngày.
- Sai ở bất kỳ bậc nào: quay về bậc 1 ngày.

## 10. Phân tích lỗ hổng

### Độ thành thạo (`mastery.ts`)
Điểm hiệu dụng của một attempt được tính như sau:
- `score` nhân với hệ số tự tin: `guess` ×0.5, `fairly` ×0.85, `sure` ×1.
- Trừ 0.1 nếu `timeSpent > 2 × estSeconds`.
- Chặn trong khoảng [0, 1].

Mastery của một chủ đề là trung bình có trọng số của các điểm hiệu dụng:
- Trọng số theo độ khó: difficulty 1/2/3 tương ứng 1/1.5/2.
- Trọng số theo thời gian: `0.5^(ageDays/14)`, tức half-life 14 ngày.

Phân mức: dưới 3 attempts là *chưa đủ dữ liệu*; dưới 0.5 là *yếu*; 0.5–0.8 là *đang học*; từ 0.8 là *vững*. Chủ đề cha được gộp từ các chủ đề con theo `weight`.

### Chẩn đoán (`recommend.ts`)
| Dấu hiệu | Chẩn đoán | Gợi ý |
|---|---|---|
| `core` từ 0.8 trở lên nhưng `pitfall`/`hard-issue` dưới 0.5 trong cùng chủ đề | Thiếu thực chiến | Làm spot-bug và hard-issue |
| mcq từ 0.8 trở lên nhưng `open` dưới 0.6 | Chưa tự giải thích được | Luyện tự luận, đọc phần "Góc phỏng vấn" |
| Từ 40% số câu đúng trở lên có mức tự tin `guess` | Kiến thức chưa chắc | Đọc phần "Cơ chế bên trong" |
| Challenge fail lặp lại ở cùng một `category` | Yếu một kiểu tình huống cụ thể | Làm challenge có cùng category |
| Cùng `misconception.id` xuất hiện từ 2 lần | Hiểu sai một khái niệm | Hiện nguyên văn khái niệm bị hiểu sai |

Top lỗ hổng được xếp theo `(1 − mastery) × weight`, với mastery tính trên các chủ đề đã đủ dữ liệu.

### Màn Result
- Điểm, thời gian, mức thay đổi mastery của từng chủ đề trong bài.
- **3 lỗ hổng lớn nhất.** Mỗi lỗ hổng có kế hoạch với thời gian ước lượng (đọc bài X → làm N câu luyện Y → challenge Z), có nút làm ngay, và được ưu tiên vào bài Daily hôm sau.
- Danh sách câu sai kèm giải thích, khái niệm bị hiểu sai và link bài học.

### Màn Progress
- Cây chủ đề tô màu theo mastery.
- Xu hướng theo tuần, streak, phân bố các loại chẩn đoán.
- Mức sẵn sàng phỏng vấn theo `group`, cảnh báo khi chưa đủ dữ liệu.

## 11. Editor và runner

**Editor**
- Monaco chỉ lazy-load ở màn Challenge, kèm khai báo kiểu cho `test`/`expect`/`clock`.
- Lỗi kiểu TypeScript chỉ cảnh báo, không chặn việc chạy.
- Code nháp tự lưu theo từng challenge.

**Runner**
- sucrase bỏ phần kiểu, chuyển TS sang JS.
- Mỗi lần chạy tạo một Web Worker mới, nạp harness cùng code của người dùng và `tests.ts`.
- Harness có `test`, `expect` (`toBe`, `toEqual`, `toThrow`, `resolves`), test async, và đồng hồ giả `clock.tick(ms)` (thay `setTimeout`/`setInterval`/`Date.now` bên trong worker).
- Timeout: huỷ worker sau 3 giây (5 giây với test async), báo "Timeout".
- Bắt lại `console.log` để hiện ở panel Output.
- **Run** chỉ chạy test không `hidden` và hiện chi tiết. **Submit** chạy tất cả: test ẩn chỉ hiện số test pass kèm `category` của các test fail, sau đó ghi attempt.
- Kết quả mỗi test có dạng `{ name, category, pass, error?, hidden }`.

## 12. Dữ liệu lưu trữ (Dexie)
| Bảng | Trường chính |
|---|---|
| `sessions` | `id, date, mode (daily\|practice), durationMin, itemIds[], startedAt, finishedAt?, overtimeSec` |
| `attempts` | `id, itemId, sessionId, score, timeSpent, confidence, usedHints, lang, at, testResults?, selected?` |
| `reviews` | `itemId, box, dueAt` |
| `drafts` | `challengeId, code, updatedAt` |
| `settings` | `lang, theme, schemaVersion` |

Có `schemaVersion` và migration qua Dexie.

## 13. Xử lý lỗi
- Content sai schema hoặc thiếu một ngôn ngữ: build fail, báo rõ file và trường.
- IndexedDB không dùng được: hiện banner, chạy tạm với dữ liệu trong bộ nhớ, nhắc export.
- Import: kiểm tra bằng zod trước, tự export một bản backup, rồi mới ghi đè.
- Runner: lỗi cú pháp khi transpile hiện trong Output và không ghi attempt. Timeout được tính là test fail.

## 14. Testing
Vitest cho toàn bộ `core/` và harness của runner. Riêng content có test kiểm tra:
- schema và đủ 2 ngôn ngữ
- không trùng `id`
- mọi tham chiếu `lessons`/`topics` đều tồn tại
- `solution.ts` của mỗi challenge pass toàn bộ `tests.ts`

UI chưa cần test tự động ở MVP.

## 15. Thiết kế giao diện
Sau khi chốt spec:
1. Tạo một Design System nhỏ riêng cho app: dark mode mặc định, phong cách giống IDE, font mono cho code, màu đúng/sai, thang màu mastery 4 mức.
2. Tạo mockup bằng Claude Design gồm các màn Today, Test, Result, Progress, Lesson, Challenge.

## 16. Thứ tự triển khai đề xuất
1. Scaffold, schema, `topics.json`, một chủ đề mẫu hoàn chỉnh
2. `core/` (grading, scheduler, mastery, sessionBuilder, recommend)
3. Storage và các màn Today → Test → Result
4. Runner, editor, challenge
5. Library, Lesson, Progress
6. Soạn nốt nội dung MVP
7. Deploy lên Cloudflare Pages
8. (Giai đoạn 2) AI
