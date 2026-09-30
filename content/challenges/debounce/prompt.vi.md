## Đề bài
Viết `debounce(fn, wait)`. Hàm trả về chỉ gọi `fn` khi đã yên lặng đủ `wait` ms kể từ lần gọi cuối, với đúng tham số của lần gọi cuối đó.

Hàm trả về có thêm `cancel()` để huỷ lần gọi đang chờ.

## Vì sao hay bị hỏi
Ô tìm kiếm gọi API theo từng phím gõ sẽ spam request và giữ JS thread bận. Interviewer thường hỏi tiếp: gọi `cancel` ở đâu khi component unmount?

## Ví dụ
```ts
const search = debounce((q: string) => api.search(q), 300);
search('r');
search('re');
search('rea'); // chỉ gọi api.search('rea'), sau 300 ms
```

## Quy ước
- `wait` bằng 0 vẫn phải chờ tới timer kế tiếp, không gọi ngay.
- Test dùng đồng hồ giả, nên chỉ dùng `setTimeout` và `clearTimeout`.
