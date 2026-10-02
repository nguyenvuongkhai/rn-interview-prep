## Đề bài
Viết `decideUpdate(installed, latest, minSupported)`. Hàm trả về:

- `'force'` khi `installed` cũ hơn `minSupported`
- `'soft'` khi không bị bắt buộc nhưng cũ hơn `latest`
- `'none'` trong các trường hợp còn lại, kể cả khi `installed` mới hơn `latest`

Version là chuỗi semver: `MAJOR.MINOR.PATCH`, có thể kèm prerelease sau dấu `-`, ví dụ `4.0.0-beta.2`.

## Vì sao hay bị hỏi
Backend bỏ một API cũ, và mọi bản dưới 2.10.0 phải cập nhật. So `'2.9.5' < '2.10.0'` như chuỗi cho ra `false`, nên chính những người cần cập nhật nhất lại không thấy lời nhắc. Interviewer thường hỏi tiếp: vì sao lỗi mạng không bao giờ được bắt cập nhật, và vì sao phải đợi staged rollout lên 100% rồi mới nâng `minSupported`?

## Ví dụ
```ts
decideUpdate('2.9.5', '2.11.0', '2.10.0'); // 'force'
decideUpdate('2.10.3', '2.11.0', '2.10.0'); // 'soft'
decideUpdate('2.11.0', '2.11.0', '2.10.0'); // 'none'
```

## Quy ước
- So `MAJOR`, `MINOR` và `PATCH` theo số, không theo chuỗi.
- Patch thiếu tính là 0: `'3.1'` bằng `'3.1.0'`.
- Prerelease nhỏ hơn bản chính thức: `'4.0.0-rc.1'` nhỏ hơn `'4.0.0'`.
- Tách prerelease theo dấu `.` rồi so từng định danh từ trái sang phải: định danh số so theo số, còn lại so theo chuỗi, và định danh số nhỏ hơn định danh không phải số. Mảng nào hết trước thì nhỏ hơn: `'1.0.0-alpha'` nhỏ hơn `'1.0.0-alpha.1'`.
- Input luôn hợp lệ, bạn không cần kiểm tra.
