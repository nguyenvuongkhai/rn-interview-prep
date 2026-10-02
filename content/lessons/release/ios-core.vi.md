---
id: release-ios-core
topic: release/ios
kind: core
readMinutes: 6
---
## TL;DR
Phát hành trên iOS gồm ba hệ thống riêng: signing (ai build, và build cho app nào), App Store Connect (version, build, TestFlight) và App Review (các guideline). Phần lớn bất ngờ trong ngày release đến từ việc nhầm lẫn giữa ba thứ này. Yêu cầu đổi hằng năm, nên hãy kiểm tra tài liệu hiện hành của Apple trước mỗi lần release.

## Cơ chế bên trong
### Signing
Distribution certificate cùng private key của nó chứng minh ai đã ký build. Key nằm trong keychain của máy đã tạo certificate, hoặc trong file `.p12` export ra. Provisioning profile gắn một App ID (bundle id) với certificate và entitlement. Profile development và ad hoc có thêm danh sách thiết bị; profile App Store thì không. Capability như Push Notifications hay Sign in with Apple phải được bật cho App ID, nếu không profile sẽ thiếu entitlement đó.

Certificate hết hạn hay bị revoke không làm hỏng app đang bán, vì Apple ký lại bản phát hành qua App Store; bạn chỉ không ký được build mới. Build phân phối cũng dùng APNs production, nên server gửi push của bản TestFlight tới sandbox sẽ nhận `BadDeviceToken`.

### Version và build
`CFBundleShortVersionString` (`MARKETING_VERSION`) là version người dùng thấy. `CFBundleVersion` (`CURRENT_PROJECT_VERSION`) là build number, và mỗi lần upload trong cùng một version cần một số mới. Sau khi upload, App Store Connect xử lý build rồi bạn mới dùng được. Version đã được duyệt thì cố định, và bản sửa tiếp theo là một version mới.

### TestFlight
Internal tester là thành viên team trong App Store Connect và nhận build ngay khi xử lý xong. External tester có thể là bất kỳ ai, mời qua email hoặc public link, và build đầu tiên của một version gửi cho họ phải qua Beta App Review. Tại thời điểm viết (2025), giới hạn là 100 internal và 10.000 external tester, và build hết hạn sau 90 ngày.

### Review và phát hành
Các lý do bị từ chối hay gặp: thiếu hoặc viết mơ hồ purpose string như `NSCameraUsageDescription`, khai background mode mà app không cần (guideline 2.5.4), và có đăng nhập bên thứ ba mà không có lựa chọn tương đương chú trọng quyền riêng tư như Sign in with Apple (guideline 4.8). Từ tháng 5/2024, build bị từ chối nếu một required-reason API, ví dụ `UserDefaults` hay file timestamp, không có lý do khai trong privacy manifest. SDK tự kèm `PrivacyInfo.xcprivacy` của chúng, và Xcode tạo được privacy report từ một archive.

Sau khi được duyệt, phased release chia cập nhật tự động ra trong 7 ngày. Pause chỉ dừng cập nhật tự động: người cài mới và người cập nhật thủ công vẫn nhận bản mới, và không có gì đưa người dùng về bản cũ. Với bản sửa khẩn cấp, bạn có thể xin expedited review, và Apple có thể từ chối.

## Góc phỏng vấn
- "App Store Connect từ chối upload vì trùng build thì tăng gì?" Build number, không phải version.
- "Rollback một bản iOS được không?" Không. Pause phased release, giảm thiệt hại bằng remote flag hoặc OTA tương thích, rồi ra version mới.
- "Làm sao để review không làm trễ ngày ra mắt?" Nộp sớm, chọn phát hành thủ công sau khi duyệt, để tài khoản demo trong ghi chú review, và kiểm tra privacy manifest của SDK mới.

## Lỗi thường gặp
- Ẩn Sign in with Apple sau một remote flag đang tắt trong lúc review
- Khai background mode như `location` mà app không hề dùng khi ở nền
- Chọn môi trường APNs theo môi trường server thay vì theo cách build được ký
- Nghĩ lỗi thiếu khai báo API đến từ code của mình, trong khi thường là do SDK
- Để danh tính ký duy nhất nằm trên laptop của một dev

## Liên quan
`release-android-core`, `release-ota-ci-core`, `native/build`
