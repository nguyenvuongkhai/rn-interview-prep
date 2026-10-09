# Bản đồ kiến thức — một mô hình cho RN, iOS và Android

Ngày: 2026-10-08. Bổ sung cho spec gốc `2026-09-30-rn-interview-prep-design.md`. Nguồn: trang `rn-knowledge-map.html` của chủ project.

## 1. Mục tiêu

Người học gặp rất nhiều thuật ngữ rời rạc: Gradle, Info.plist, Activity, JSI, Fabric. Bản đồ cho họ một mô hình để xếp từng thuật ngữ vào chỗ của nó: thuật ngữ nằm ở tầng nào (JS, runtime RN, native), và cùng một khái niệm được gọi là gì trên React Native, iOS và Android.

P9 đưa trang HTML đó vào app thành màn **Bản đồ** (`#/map`), song ngữ, theo theme của app, và lưu ô tick như các setting khác.

### Ngoài phạm vi
- Thay đổi màn Roadmap. Phần "theo cấp độ" của bản đồ trùng một phần với Roadmap, nhưng hai màn vẫn tách riêng (đã chốt với chủ project).
- Font và màu riêng của trang HTML gốc. Màn mới dùng token và component có sẵn của app.
- Link từ bản đồ tới câu hỏi, bài học hay topic.
- Lưu tab cấp độ đang chọn. Đó là state UI, mở lại màn thì về Junior.

## 2. Màn hình

Route `#/map`, tab "Bản đồ / Map" trên TopBar, nằm sau Lộ trình. Màn `src/screens/MapScreen.tsx` có các phần theo thứ tự:

| Phần | Nội dung |
|---|---|
| Đầu trang | Tiêu đề, một câu dẫn |
| Ba tầng | Code JS/TS, runtime RN (kèm các phần: Hermes, JSI, Fabric, TurboModules, Yoga, Metro), và hai app native iOS và Android đặt cạnh nhau |
| Bảng đối chiếu | 28 khái niệm × RN / iOS / Android, có ô tìm kiếm và đếm "x / 28 khái niệm" |
| Theo cấp độ | Ba tab Junior / Middle / Senior, mỗi tab hiện tiến độ "đã tick / 4". Mỗi cấp có một câu tagline, ba cột RN / iOS / Android, và 4 câu tự kiểm tra có ô tick |
| Kiến trúc cũ và mới | 6 hàng: cũ, mới, điều gì thay đổi |
| Từ một cú chạm tới pixel | 7 bước, mỗi bước có nhãn nơi chạy (ví dụ "UI thread · native") |
| Năm thói quen | 5 thẻ mẹo |

- **Tìm kiếm:** không phân biệt hoa thường, so khớp trên tên khái niệm theo ngôn ngữ đang chọn và cả ba ô thuật ngữ. Không có kết quả thì hiện một dòng "Không có khái niệm nào khớp".
- **Tab cấp độ:** dùng `pill` với `role="radio"` như bộ chọn track và level của Roadmap.
- **Ô tick:** bấm là lưu ngay. Nếu lưu thất bại thì trả ô về trạng thái cũ, giống Roadmap.
- **Mobile:** bảng nằm trong khung cuộn ngang riêng, trang không cuộn ngang. Ba cột của mỗi cấp xếp chồng khi màn hẹp.

## 3. Nội dung

Một file `content/map/map.json`, có dạng:

```json
{
  "layers": [
    {"id": "js", "title": {"vi": "…", "en": "…"}, "body": {"vi": "…", "en": "…"}},
    {"id": "runtime", "title": {…}, "body": {…}, "parts": [{"vi": "Hermes: engine JS", "en": "Hermes: JS engine"}]},
    {"id": "ios", "title": {…}, "body": {…}},
    {"id": "android", "title": {…}, "body": {…}}
  ],
  "rows": [
    {"concept": {"vi": "Điểm vào của app", "en": "App entry point"},
     "rn": "index.js → AppRegistry", "ios": "AppDelegate / SceneDelegate", "android": "Application / MainActivity"}
  ],
  "levels": [
    {"id": "junior", "name": {…}, "tag": {…},
     "rn": [{…}], "ios": [{…}], "android": [{…}],
     "checks": [{"id": "map-junior-1", "text": {…}}]}
  ],
  "arch": [{"old": "Bridge", "new": "JSI", "change": {"vi": "…", "en": "…"}}],
  "trace": [{"step": {"vi": "…", "en": "…"}, "where": "UI thread · native"}],
  "habits": [{"title": {…}, "body": {…}}]
}
```

- **Song ngữ:** câu văn là `{vi, en}`. Tên API, công cụ và file (`FlatList`, `Info.plist`, `Gradle`) để nguyên tiếng Anh, nên ba ô thuật ngữ của bảng, cột cũ/mới của bảng kiến trúc và nhãn `where` của trace là chuỗi đơn.
- **Inline code:** câu văn được dùng backtick, hiển thị bằng component `Rich` có sẵn.
- **Tầng:** `layers` là mảng, id thuộc `js`, `runtime`, `ios`, `android`, không trùng. `parts` tuỳ chọn.
- **Cấp độ:** đúng ba cấp, theo thứ tự `junior`, `middle`, `senior`. Mỗi cấp có đúng 4 câu tự kiểm tra, id dạng `map-<level>-<n>`. Mỗi câu có `answer` song ngữ (đáp án mẫu 2–4 câu), ẩn sau nút "Xem đáp án mẫu" (bổ sung ngày 2026-10-09).
- **Số lượng:** lấy từ trang gốc: 28 hàng, 6 hàng kiến trúc, 7 bước, 5 thói quen. Schema không khoá các con số này, trừ ba cấp độ.
- **Bản tiếng Việt:** dịch theo văn phong các file roadmap hiện có, giữ thuật ngữ tiếng Anh khi người làm nghề vẫn dùng tiếng Anh.

## 4. Kiến trúc

- **Schema:** `mapSchema` bằng zod trong `src/core/schema.ts`, export kiểu `KnowledgeMap`, `MapLayer`, `MapLayerId`, `MapRow`, `MapLevel`, `MapLevelId`.
- **Loader:** `loadContent` nhận thêm `map` (tuỳ chọn, để test cũ không phải đổi; thiếu thì là `EMPTY_MAP`, mọi mảng đều rỗng). `src/content/index.ts` đọc `/content/map/map.json` bằng `import.meta.glob`. File sai schema làm `npm run check` và build thất bại, như content khác.
- **Kiểm tra chéo:** `checkMap` trong `integrity.ts` báo lỗi khi id tầng bị trùng, khi có cấp độ mà không đúng ba cấp theo thứ tự `junior`, `middle`, `senior`, khi id câu tự kiểm tra không bắt đầu bằng `map-<level>-`, hoặc bị trùng.
- **Hàm thuần** `src/app/map.ts`:
  - `MAP_SETTING = 'map'`.
  - `filterRows(rows, query, lang)` trả các hàng khớp; query rỗng thì trả hết.
  - `levelProgress(level, checked)` trả `{done, total}`.
  - Ô tick dùng lại `toggleChecked`, `readChecked`, `isStringArray` của `roadmap.ts`.
- **App:** gộp `toggleRoadmap` thành `toggleTicks(list, id)` dùng chung cho `roadmap` và `map`. `App.tsx` đọc setting `map` lúc boot cùng `lang`, `theme`, `roadmap`, và truyền `checked` cùng `onChecked` vào `MapScreen`.
- **Backup:** thêm `map` vào `KNOWN_SETTINGS`, giá trị phải là mảng chuỗi.
- **Router và TopBar:** thêm `{ name: 'map' }` vào `Route`, `parseRoute`, và `NAV`.
- **Chuỗi UI:** key `map` cho tab, các key còn lại có tiền tố `km` vì `mapTitle` đã là "Bản đồ chủ đề" của màn Tiến độ. Thêm vào `src/i18n/strings.ts` (tên tab, tiêu đề và câu dẫn của từng phần, placeholder tìm kiếm, đếm kết quả, không có kết quả, tiến độ cấp độ).
- **CSS:** thêm ít class tiền tố `km-` (vì `.map-grid` đã có) cho chồng ba tầng, bảng và danh sách trace, dùng token màu có sẵn.

## 5. Test

Chủ project tự chạy test; agent chỉ viết.

- `src/app/map.test.ts`: lọc theo thuật ngữ, theo tên khái niệm ở cả hai ngôn ngữ, không phân biệt hoa thường, query rỗng; đếm tiến độ bỏ qua id không thuộc cấp đó.
- `src/content/load.test.ts`: file bản đồ sai schema bị từ chối; thiếu `map` vẫn load được.
- Test integrity (trong `load.test.ts`): cấp độ sai thứ tự, id câu tự kiểm tra trùng hoặc sai tiền tố, đều bị báo lỗi.
- `src/app/backup.test.ts`: setting `map` hợp lệ được nhận, giá trị không phải mảng chuỗi bị từ chối.
- `src/app/router.test.ts`: `#/map` parse đúng, `href({ name: 'map' })` ra `#/map`.
- `src/content/content.test.ts` (đã chạy trên content thật) sẽ bắt lỗi trong `map.json`.

## 6. Chia việc

1. **Code:** schema, loader, integrity, `map.ts`, router, TopBar, backup, chuỗi UI, `MapScreen`, CSS, kèm test. Chưa cần `map.json`: thiếu file thì màn chạy với bản đồ rỗng.
2. **Nội dung:** `map.json` đầy đủ, song ngữ, chuyển từ trang HTML gốc.
3. **Tài liệu và rà soát:** thêm mục Bản đồ vào `docs/content-guide.md`, rà độ chính xác của nội dung.

Mỗi task kết thúc bằng checkpoint để chủ project chạy `npm run check`. Commit một dòng `P9: …`.
