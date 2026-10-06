# Hướng dẫn soạn nội dung

Người đọc: người soạn nội dung (người hoặc agent). Tài liệu này bổ sung cho schema trong `src/core/schema.ts` và các kiểm tra trong `src/content/`. Content sai schema làm `npm run check` fail.

## Người học và giọng văn

- **Người học:** dev React Native đang ôn phỏng vấn mức **senior**. Họ đã biết cơ bản. Câu hỏi phải đo được **hiểu cơ chế** và **kinh nghiệm thực chiến**, không phải nhớ tên API.
- **Song ngữ:** mọi text đều có `vi` và `en`, hai bản cùng nội dung chứ không dịch word-by-word.
  - Bản tiếng Việt giữ thuật ngữ tiếng Anh (re-render, bridge, JSI, FlatList, closure).
  - Bản tiếng Anh viết tự nhiên, như một senior engineer nói trong buổi phỏng vấn.
- **Câu văn:** ngắn, thẳng, gọi người đọc là "bạn" / "you". Không dùng emoji, không đùa, không khen chê.
- **Code:** dùng TypeScript, kể cả code trong câu `spot-bug`: khai báo kiểu cho props, không để `any` ngầm. Viết inline thì đặt trong backtick. Code block trong bài học dùng fence ```` ```ts ````.
- **Không dùng chữ đậm hay nghiêng** (`**…**`, `*…*`) ở bất cứ đâu trong content. Renderer chỉ hiểu backtick, nên dấu sao sẽ hiện nguyên trên màn hình.

## Độ chính xác (quan trọng nhất)

- Mốc phiên bản:
  - **RN 0.76 trở lên:** kiến trúc mới (Fabric, TurboModules, Bridgeless) bật mặc định, Hermes là engine mặc định. RN 0.76 và 0.77 vẫn đi kèm React 18.3.
  - **RN 0.78 trở lên:** có React 19 (Actions, `use`, `<Context>` làm provider…).
  - **React 19.2 trở lên:** có `useEffectEvent`.
  - **React Compiler 1.0:** là Babel plugin, không phát hiện được mọi vi phạm Rules of React.
  - Tính năng nào gắn với một phiên bản thì phải ghi rõ phiên bản đó.
- Nếu một hành vi phụ thuộc phiên bản, ghi rõ trong phần giải thích, ví dụ "từ RN 0.76…". Không chắc thì đừng khẳng định con số.
- Không bịa tên API, prop hay flag. Mọi prop được nêu phải có thật: `windowSize`, `maxToRenderPerBatch`, `getItemLayout`, `removeClippedSubviews`…
- Mỗi đáp án đúng phải **đúng trong mọi trường hợp hợp lý**. Mỗi đáp án sai phải **sai rõ ràng**. Tránh các đáp án "đúng một nửa".

## Cơ cấu một chủ đề (khoảng 12–14 item)

| Loại | Số lượng | `kind` gợi ý | `difficulty` |
|---|---|---|---|
| `mcq` một đáp án | 3 | `core` ×2, `advanced` ×1 | 1–2 |
| `mcq` nhiều đáp án (`multi: true`) | 2 | `pitfall`, `advanced` | 2 |
| `spot-bug` | 3 | `pitfall` ×2, `hard-issue` ×1 | 2–3 |
| `open` | 2–3 | `advanced`, `hard-issue` | 2–3 |
| `challenge` (nếu chủ đề có thuật toán TS thuần) | 0–1 | `core` / `advanced` | 1–3 |

- **Mức khó:** khoảng một nửa số câu ở mức 2 (senior), mỗi chủ đề có ít nhất 2 câu mức 3.
- **`estSeconds`:**
  - mcq: 45–90
  - spot-bug: 90–150
  - open: 240–360
  - challenge: 300 (nhỏ), 600 (vừa), 900 (khó)

## Quy ước theo loại câu

**Chung**
- **`id`:** dạng `<topic-slug>-NNN`, ví dụ `render-memo-005`. Tăng dần, không dùng lại id.
- **`topics`:** phần tử đầu là chủ đề chính. Chỉ thêm chủ đề phụ khi câu thật sự thuộc cả hai.
- **`lessons`:** trỏ tới bài học của chủ đề (id phải tồn tại).

**`mcq`**
- 4–5 đáp án, độ dài tương đương nhau. **Đáp án đúng không được dài nhất rõ rệt:** nếu dài hơn đáp án dài nhất còn lại quá khoảng 20% thì rút gọn nó. Quy tắc này áp dụng cho cả `causeOptions`.
- Mỗi đáp án chỉ trả lời đúng câu được hỏi. Không thêm mệnh đề lý do nói về một tình huống khác, vì người đọc kỹ sẽ hiểu thành đáp án sai.
- Không dùng đáp án sai kiểu "cho đủ số" (ví dụ "phải khai báo kiểu"). Mỗi đáp án sai nên là một hiểu sai có thật.
- Đáp án sai nào thể hiện một **hiểu sai có thật** thì gắn `misconception`: `id` dạng kebab ngắn, `text` giải thích người chọn đang nghĩ sai điều gì và thực tế ra sao. Đáp án đúng **không** được có `misconception`.
- Dùng lại cùng một `misconception.id` giữa các câu khi đó là cùng một hiểu sai, vì chẩn đoán đếm theo id. Khi dùng lại, `text` phải giống hệt.
- `explanation` nói vì sao đáp án đúng là đúng, và chỉ ra bẫy chính.

**`spot-bug`**
- Code dài 8–20 dòng, thực tế, có đúng một dòng gây lỗi. `answerLine` tính từ 1, và phải đếm lại chính xác (dòng trống cũng tính).
- `causeOptions` gồm 4 lựa chọn, có một lựa chọn đúng. Lựa chọn sai gắn `misconception` như với mcq.
- Code viết trong JSON phải escape: xuống dòng là `\n`, dấu nháy kép là `\"`.

**`open`**
- Viết như câu hỏi phỏng vấn thật, thường là một tình huống sự cố.
- `keyPoints` gồm 4–6 ý, mỗi ý là một hành động hoặc khái niệm kiểm tra được.
- `modelAnswer` khoảng 80–150 từ, trả lời như người đang nói trong buổi phỏng vấn.
- `followUps` gồm 1–2 câu hỏi nối tiếp.

**`challenge`**
- Chỉ dùng TypeScript thuần, không cần React hay RN. Ví dụ: debounce, retry có backoff, LRU cache, diff danh sách, event emitter, state machine, queue offline.
- Mỗi challenge là một thư mục gồm 6 file (xem `content/challenges/debounce/`).
- `tests.ts` có 4–6 test, trong đó ít nhất 2 test `hidden: true`. `category` là một trong `basic`, `edge-case`, `async-order`, `perf`.
- `solution.ts` phải pass mọi test. `starter.ts` phải fail ít nhất một test.
- Promise mà test có thể bỏ lửng phải có `.catch(() => {})`, để tránh lỗi unhandled rejection khi chạy với starter.
- Harness có `test(name, fn, { category, hidden })`, `expect` (`toBe`, `toEqual`, `toThrow`, `resolves.*`, `rejects.toThrow`) và `clock.install/tick/tickAsync`.

## Bài học

- Mỗi chủ đề có 1–2 bài: một bài `core` (cơ chế) và tuỳ chọn một bài `pitfall`.
- Mỗi bài có 2 file `<slug>.vi.md` và `<slug>.en.md` trong `content/lessons/<root>/`. Frontmatter của 2 file phải giống hệt nhau: `id`, `topic`, `kind`, `readMinutes`.
- **Khung cố định:**

| Tiếng Việt | Tiếng Anh |
|---|---|
| `## TL;DR` | `## TL;DR` |
| `## Cơ chế bên trong` | `## Under the hood` |
| `## Góc phỏng vấn` | `## Interview angle` |
| `## Lỗi thường gặp` | `## Common pitfalls` |
| `## Liên quan` | `## Related` |

- **Độ dài:** 300–600 từ mỗi bản (bản tiếng Việt đếm theo âm tiết nên số từ cao hơn, không sao). `readMinutes` từ 4 tới 8, và phải khớp với độ dài thật.
- Bài `pitfall` phải liệt kê đúng các lỗi mà các câu `pitfall`/`hard-issue` trỏ tới bài đó đang kiểm tra.
- **Markdown được hỗ trợ:** heading `##`/`###`, đoạn văn, list `-`, code fence, và `inline code`. Không dùng bảng, link, ảnh hay chữ đậm. Parser không hỗ trợ các định dạng đó.

## Không lặp ý

Mỗi item kiểm tra một ý khác nhau. Hai item cùng một tình huống và cùng một cách sửa thì bỏ bớt một, hoặc viết lại để kiểm tra một khía cạnh khác.

## Chính tả tiếng Anh

Dùng chính tả Anh–Anh (optimise, behaviour), trừ thuật ngữ React giữ nguyên dạng gốc: memoize, `useMemo`.

## Trước khi giao

1. `node -e "JSON.parse(require('fs').readFileSync('<file>','utf8'))"` cho từng file JSON.
2. Kiểm tra id không trùng, `lessons` và `topics` được trỏ tới đều tồn tại, và `answerLine` đếm lại đúng.
3. Đọc lại bản `vi` và bản `en`, bảo đảm chúng cùng nội dung và cùng đáp án.

## Chủ đề vận hành: release, native, bảo trì

Ba nhóm này bù phần kinh nghiệm khó tự có trong thời gian ngắn, nên ưu tiên **sự cố thật** hơn lý thuyết.

- Mỗi chủ đề có ít nhất 3 item dạng tình huống production, ví dụ:
  - build bị store reject
  - crash chỉ xảy ra trên một loại máy hoặc một phiên bản OS
  - một dependency vỡ sau khi nâng RN

  Các item này dùng `kind: hard-issue` hoặc `pitfall`, và câu `open` viết như người phỏng vấn hỏi "kể lại cách bạn xử lý".
- Quy định của store thay đổi theo năm: target API level của Play, các yêu cầu của App Store review, privacy manifest… Vì vậy hãy viết theo **cơ chế** và **cách tra cứu** (ví dụ: "Play yêu cầu targetSdk tăng hằng năm, kiểm tra trong Play Console › Policy status"). Không khẳng định con số có thể đã cũ. Bắt buộc phải nêu một con số thì ghi kèm thời điểm.
- `spot-bug` có thể dùng file cấu hình (Gradle, `Podfile`, `Info.plist`, `app.json`, workflow CI) chứ không chỉ TSX. Xuống dòng vẫn escape là `\n`.
- Challenge chỉ dùng TypeScript thuần, ví dụ:
  - so sánh semver để bắt buộc cập nhật
  - gom nhóm crash theo fingerprint của stack trace
  - chọn bundle OTA tương thích với runtime version
  - parse và gom nhóm log

## Tên file

- **Câu hỏi:** `content/questions/<topic-slug>.json`, với slug là id chủ đề thay `/` bằng `-`. Ví dụ `release/ios` → `release-ios.json`, item id `release-ios-001`.
- **Bài học:** `content/lessons/<root>/<leaf>-core.{vi,en}.md` (và `-pitfalls` nếu có). Ví dụ `content/lessons/release/ios-core.vi.md`, lesson id `release-ios-core`.
- **Challenge:** `content/challenges/<id>/` với id kebab-case, không trùng challenge có sẵn (`debounce`, `map-limit`).

## Lab

Lab dạy vế "làm sao bạn biết nó đã hiệu quả?" của câu hỏi phỏng vấn. Mỗi lab là một ca thật, đi từ triệu chứng tới con số chứng minh bản sửa có tác dụng. Người đọc chưa có nhiều kinh nghiệm thực tế, nên mọi bước phải cụ thể: code chạy được, bấm gì trong công cụ, và tín hiệu đọc được nghĩa là gì.

- **File:** `content/lessons/<root>/<leaf>-lab.{vi,en}.md`, lesson id `<root>-<leaf>-lab`, frontmatter `kind: lab`. Frontmatter của 2 file vẫn phải giống hệt nhau.
- **Dòng đầu của thân bài** là tiêu đề dạng `# <tiêu đề>`, khác nhau theo ngôn ngữ. Không bắt đầu tiêu đề bằng chữ "Lab", vì app tự thêm.
- **Khung cố định** (sau dòng tiêu đề):

| Tiếng Việt | Tiếng Anh |
|---|---|
| `## Tình huống` | `## The case` |
| `## Dựng lại lỗi` | `## Reproduce it` |
| `## Đo` | `## Measure` |
| `## Đọc tín hiệu` | `## Read the signal` |
| `## Sửa` | `## Fix` |
| `## Đo lại` | `## Measure again` |
| `## Nói trong phỏng vấn` | `## Say it in the interview` |
| `## Liên quan` | `## Related` |

- **Độ dài:** 700–1200 từ văn xuôi mỗi bản, không tính code và prompt trong fence; `readMinutes` từ 8 tới 15.
- **Các bước** dùng bullet `-`. Parser không hỗ trợ danh sách đánh số.
- **Code** là TSX/TS trong fence ```` ```ts ````, đủ nhỏ để dán vào một app thử.
- **Con số** trong "Đọc tín hiệu" và "Đo lại" là ví dụ minh hoạ: ghi rõ là ví dụ, và nói người đọc sẽ thấy con số khác trên máy của họ.
- **Độ chính xác của công cụ:**
  - Không bịa menu, nút hay flag. Không chắc vị trí chính xác trong giao diện thì mô tả theo chức năng ("mở tab Memory, chụp heap snapshot").
  - Bước nào phụ thuộc phiên bản thì ghi rõ, ví dụ "React Native DevTools là debugger mặc định từ RN 0.76".
  - Luôn đo trên release hoặc profile build; dev build chậm hơn nhiều và cho kết luận sai.
- **Gắn lab vào câu hỏi:** thêm lab id vào `lessons` của các câu `open` và `spot-bug` mà lab trả lời vế "làm sao biết". App hiện link "Cách kiểm chứng" cạnh đáp án mẫu của câu `open`, và cạnh phần giải thích của câu `open`/`spot-bug` khi xem lại ở màn Result.

## Nhóm testing, debug và ai

- **testing và debug:** ưu tiên tình huống thật (một test bị flaky, một bug chỉ có trên release build), giống quy tắc của các nhóm vận hành. Code test viết theo Jest và React Native Testing Library; không bịa matcher hay API.
- **ai:** viết theo cách làm, không gắn với một sản phẩm cụ thể (Copilot, Cursor, Claude Code…), vì tính năng của các công cụ đổi rất nhanh. Câu `open` viết như interviewer hỏi "kể một lần bạn dùng AI để…", và `modelAnswer` là một ca thật có bối cảnh, prompt, cách kiểm chứng và kết quả. Đáp án đúng luôn đặt trách nhiệm kiểm chứng ở người dev.
