---
id: arch-new-arch-bridge-vs-jsi
topic: architecture/new-arch
kind: core
readMinutes: 5
---
## TL;DR
Bridge cũ gửi **message JSON bất đồng bộ, theo lô** giữa JS và native. Kiến trúc mới thay nó bằng **JSI**, để JavaScript gọi thẳng vào native. Đây là mặc định từ React Native 0.76.

## Cơ chế bên trong
- **Bridge cũ:** mọi lời gọi đều được serialize sang JSON, xếp hàng rồi gửi bất đồng bộ. Khi lưu lượng lớn (cuộn nhanh, animation), bridge thành nút thắt cổ chai và không gì chạy đồng bộ được.
- **JSI (JavaScript Interface):** một lớp C++ cho phép JavaScript giữ tham chiếu tới object native và gọi trực tiếp, không qua JSON.
- **TurboModules:** native module chỉ được nạp khi dùng lần đầu (khởi động nhanh hơn). **Codegen** sinh code native type-safe từ spec TypeScript.
- **Fabric:** renderer mới. Layout đồng bộ (không bị nháy khi đo layout) và hỗ trợ các tính năng concurrent của React như `useTransition` và Suspense.

## Góc phỏng vấn
- "Nâng cấp có đáng với khách hàng không?" Có: khởi động nhanh hơn, UI mượt hơn, ít lỗi kiểu dữ liệu giữa JS và native, và đi kịp hệ sinh thái. Các bản gần đây chỉ chạy trên kiến trúc mới, và thư viện như Reanimated 4 bắt buộc nó.
- "Cái giá là gì?" Chi phí migrate: kiểm tra thư viện bên thứ ba, thay thư viện không hỗ trợ, migrate custom native module, nâng cấp từng bước, test cả hai nền tảng.
- "JSI cho JS giữ cái gì?" Tham chiếu tới object native (C++), và gọi trực tiếp vào chúng.

## Lỗi thường gặp
- Nói rằng kiến trúc mới xoá bỏ *mọi* vấn đề hiệu năng. Code JavaScript nặng của chính bạn vẫn chặn JS thread.
- Gọi Hermes là một phần của kiến trúc mới. Hermes là JS engine và dùng được với cả hai kiến trúc.
- Trả lời tuyệt đối ("không còn nghẽn gì nữa"). Hãy nói "loại bỏ nút thắt của bridge".

## Liên quan
`architecture/threading`
