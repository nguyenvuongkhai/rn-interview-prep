---
id: workflow-git-agile-core
topic: workflow/git-agile
kind: core
readMinutes: 6
---
## TL;DR
Nhóm mobile không deploy lại được như nhóm web: mọi binary đều qua store review, và nhiều version cùng chạy một lúc. Vì thế nhóm mobile giữ release branch và tag, kể cả khi làm trunk-based. Hotfix bắt đầu từ tag release, và chỉ xong khi bản sửa cũng đã có trên `main`. Về Agile, store review và QA trên máy thật phải nằm trong kế hoạch và trong definition of done.

## Cơ chế bên trong
### Mô hình branch
- Git Flow giữ một `develop` sống lâu, cộng các branch `release/*` và `hotfix/*`. Nó dễ đoán, nhưng feature branch kéo dài thường kết thúc bằng những đợt merge vất vả.
- Trunk-based development merge các branch sống ngắn vào `main` mỗi ngày, sau CI và review bắt buộc. Việc chưa xong nằm sau feature flag, nên merge và phát hành là hai quyết định tách biệt.
- Mobile thường kết hợp cả hai: trunk-based hằng ngày, cộng một branch `release/3.5` cắt từ `main` theo lịch release train. Chọn một quy tắc chung cho bản sửa, ví dụ sửa trên `main` trước rồi cherry-pick sang release branch.

### Quy trình hotfix
Bắt đầu từ đúng thứ đang chạy ở production: `git switch -c hotfix/3.4.1 v3.4.0`. Giữ bản sửa nhỏ nhất, tăng version và build number trên store, gắn tag `v3.4.1` rồi build từ tag. Sau đó đưa bản sửa về `main` bằng merge, hoặc cherry-pick đúng commit sửa lỗi. Tag chỉ trỏ tới một commit, thường là commit tăng version, nên `git cherry-pick v3.4.1` bỏ sót bản sửa. Quyết định OTA hay binary trước: bản sửa chỉ ở JS và cùng runtime version thì phát OTA được; đụng tới native thì cần bản build mới.

### Viết lại lịch sử
Rebase, amend và reset đều tạo hash mới. Trên branch của riêng bạn thì ổn, sau đó push bằng `git push --force-with-lease`, lệnh này từ chối khi remote có commit bạn chưa fetch. Trên branch dùng chung, hãy dùng `git revert <sha>`.

### Tìm và sửa regression
`git bisect` chia đôi dải commit sau mỗi bước, nên 400 commit cần khoảng 9 lần thử. Commit không build được thì đánh dấu bằng `git bisect skip`, không bao giờ đánh good hay bad.

### Lockfile và file bị ignore
Lockfile là output được tạo ra. Khi xung đột, gộp `package.json` bằng tay, lấy lockfile của một bên, chạy lại `npm install`, rồi `pod install`, và commit cả hai. Trong `.gitignore`, rule khớp cuối cùng thắng, nên một dòng `!` phía sau có thể đưa keystore trở lại; `git check-ignore -v <path>` cho biết dòng quyết định. Secret đã lọt vào lịch sử là đã lộ: hãy thay nó.

### Agile trên mobile
Conventional Commits quyết định semver: `fix` là patch, `feat` là minor, `!` hoặc `BREAKING CHANGE:` là major. Một story done là đã thử trên máy thật ở cả hai nền tảng, có số liệu đo, và nằm sau flag. Lập kế hoạch tính ngược từ ngày submit, vì thời gian review thay đổi và một lần bị reject tốn thêm một vòng. Sự cố production giữa sprint là việc ngoài kế hoạch: báo PO và rút bớt lượng việc tương đương.

## Góc phỏng vấn
- "Production crash và `main` đang có code chưa phát hành. Kể lại quy trình hotfix." Tag, branch, bản sửa nhỏ nhất, tăng version, staged rollout, đưa về `main`, post-mortem.
- "Sao không deploy thẳng từ trunk?" Vì store review và nhiều version cùng chạy; bạn phải vá bản cũ trong khi `main` đi tiếp.

## Lỗi thường gặp
- Tạo branch hotfix từ `main`
- Cherry-pick tag release thay vì commit sửa lỗi
- Rebase hoặc force-push một branch dùng chung
- Gộp tay `package-lock.json`
- Dòng phủ định trong `.gitignore` đưa keystore hoặc `.env` trở lại
- Điều kiện `if:` theo `github.ref` trong CI làm required check bị skip ở mọi PR
- Coi "đã submit review" là done

## Liên quan
`release-ota-ci-core`, `maintain-regression-core`, `release/android`, `release/ios`
