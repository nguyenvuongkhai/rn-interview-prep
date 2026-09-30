## Đề bài
Viết `mapLimit(items, limit, fn)`: gọi `fn` cho từng phần tử, không bao giờ có quá `limit` lời gọi đang chạy cùng lúc, và trả về kết quả đúng thứ tự đầu vào.

Một slot vừa rảnh thì phải bắt đầu phần tử kế tiếp ngay, không đợi cả nhóm xong.

## Tình huống thật
Upload 40 ảnh từ camera roll nhưng chỉ cho 3 request song song, để không nghẽn mạng di động và không bị server từ chối.

## Ví dụ
```ts
const urls = await mapLimit(photos, 3, (photo) => upload(photo));
// urls[i] là kết quả của photos[i]
```

## Quy ước
- Mảng rỗng trả về `[]` và không gọi `fn`.
- Nếu `fn` reject thì `mapLimit` cũng reject với lỗi đó.
