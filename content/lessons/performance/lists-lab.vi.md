---
id: performance-lists-lab
topic: performance/lists
kind: lab
readMinutes: 11
---
# Chứng minh một feed giật đã nhanh hơn

## Tình huống
Một feed hiển thị hơn 1.000 bài viết, mỗi bài có ảnh và một đoạn text. Chiều cao khác nhau nhưng biết trước khi render, vì API trả về tỉ lệ ảnh của từng bài. Khi vuốt nhanh, list bị giật và hiện vùng trắng trước khi row kịp hiện. Bạn phải sửa, và chứng minh bản sửa bằng con số từ cùng một kịch bản cuộn.

## Dựng lại lỗi
Dán đoạn code này vào một app thử. Nó có đủ các lỗi quen thuộc: `renderItem` inline tạo callback mới cho mỗi row, row không được memo, không có `keyExtractor` (trường id tên là `postId`, nên FlatList quay về key theo index), không có `getItemLayout`, và ảnh kích thước gốc. `burn` đóng vai chi phí thật của một row.

```ts
import React, { useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';

type Post = { postId: string; text: string; imageUrl: string; height: number };
type RowProps = { post: Post; liked: boolean; onLike: (id: string) => void };

const burn = (ms: number) => { const end = Date.now() + ms; while (Date.now() < end) {} };

function PostRow({ post, liked, onLike }: RowProps) {
  burn(3); // giả lập chi phí của row
  return (
    <View style={{ height: post.height }}>
      <Image source={{ uri: post.imageUrl }} style={{ flex: 1 }} />
      <Text numberOfLines={3}>{post.text}</Text>
      <Pressable onPress={() => onLike(post.postId)}><Text>{liked ? 'Liked' : 'Like'}</Text></Pressable>
    </View>
  );
}

export function Feed({ posts }: { posts: Post[] }) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  return (
    <FlatList
      data={posts}
      renderItem={({ item }) => (
        <PostRow
          post={item}
          liked={!!liked[item.postId]}
          onLike={(id) => setLiked((s) => ({ ...s, [id]: !s[id] }))}
        />
      )}
    />
  );
}
```

Tạo 1.000 bài với chiều cao từ 200 tới 400 và URL ảnh kích thước lớn.

## Đo
Cố định điều kiện đo trước:
- Một máy thật, tốt nhất là điện thoại Android tầm trung. Emulator không chạy giống phần cứng thật.
- Release build cho mọi con số bạn báo cáo. Dev build chạy thêm nhiều kiểm tra và làm JS trông chậm hơn nhiều.
- Một kịch bản cuộn cố định, để lần chạy nào cũng vuốt giống nhau.
- Chạy nhiều lần (3 tới 5 lần) và so sánh giá trị trung bình.

Công cụ, theo thứ tự:
- Perf Monitor: mở Dev Menu, chọn Perf Monitor. Nó hiện UI FPS (main thread phía native) và JS FPS (JS thread). Công cụ này chỉ có trong debug build, nên chỉ dùng nó để xem thread nào tụt khi vuốt, không lấy làm kết quả.
- React DevTools Profiler: trong React Native DevTools (debugger mặc định từ RN 0.76), mở Profiler, bật tuỳ chọn ghi lại lý do mỗi component render, bấm record, vuốt list, rồi dừng. Đếm số lần `PostRow` render và lý do. Số lần render có ý nghĩa trên dev build; thời gian render thì không.
- Flashlight: công cụ mã nguồn mở cho Android của BAM, đo FPS, CPU theo từng thread và RAM trên máy thật, rồi cho một điểm tổng. `flashlight measure` hiện số liệu trực tiếp trong lúc bạn tự thao tác app. `flashlight test` chạy một lệnh test nhiều lần và lấy trung bình; xem `flashlight test --help` để biết các tuỳ chọn của phiên bản bạn dùng. Trên iOS, dùng Xcode Instruments với release build.
- Vùng trắng: quay màn hình lúc vuốt, xem lại từng khung hình và đếm số khung có cell trống. Cách này dùng được cho mọi loại list. FlashList còn có hook theo dõi vùng trắng là `useBlankAreaTracker`; xem tài liệu của FlashList để biết chữ ký hiện tại.

Để có kịch bản cuộn, một Maestro flow là đủ: `launchApp`, rồi một số bước `swipe` cố định với `direction: UP`. Truyền flow đó cho `flashlight test` làm lệnh test.

## Đọc tín hiệu
Con số ví dụ trên một máy Android tầm trung; trên máy của bạn sẽ khác:
- Perf Monitor lúc vuốt: UI FPS giữ quanh 60, JS FPS tụt xuống 10–20. Phía native cuộn ổn; JS không render row kịp.
- Profiler: bấm like một bài làm mọi `PostRow` đang mount render lại, vì mỗi row nhận một hàm `onLike` mới và không row nào được memo.
- Flashlight, 5 lần chạy: FPS trung bình 41, CPU của JS thread gần 100% trong lúc vuốt, điểm 48.
- Video: 52 trên 180 khung hình có ít nhất một cell trống.

Cách đọc:
- UI FPS ổn, JS FPS thấp: chi phí nằm ở JS, chủ yếu là `renderItem` và các row nó tạo ra. Làm row rẻ hơn trước tiên.
- UI FPS cũng thấp: xem phần việc phía native, như decode ảnh lớn, shadow nặng hay cây view quá sâu.
- Có cell trống trong lúc JS bận: vùng render không theo kịp cú vuốt. Chỉnh vùng render chỉ che triệu chứng; row rẻ hơn mới sửa gốc.

## Sửa
Làm row rẻ và ổn định, rồi giúp FlatList không phải tự đo:

```ts
import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, ListRenderItemInfo } from 'react-native';

// vẫn là PostRow cũ, giữ cả burn, để so sánh trước và sau cho công bằng
const FastRow = memo(PostRow);

export function FastFeed({ posts }: { posts: Post[] }) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const onLike = useCallback((id: string) => setLiked((s) => ({ ...s, [id]: !s[id] })), []);
  const offsets = useMemo(() => {
    const o = [0];
    for (const p of posts) o.push(o[o.length - 1] + p.height);
    return o;
  }, [posts]);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Post>) => (
      <FastRow post={item} liked={!!liked[item.postId]} onLike={onLike} />
    ),
    [liked, onLike],
  );
  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.postId}
      renderItem={renderItem}
      getItemLayout={(_, index) => ({ length: posts[index].height, offset: offsets[index], index })}
      windowSize={11}
      maxToRenderPerBatch={5}
    />
  );
}
```

Tác dụng của từng thay đổi:
- `memo` cùng một `onLike` ổn định: sau một lần like, chỉ row có `liked` thay đổi render lại.
- `keyExtractor` theo `postId`: định danh ổn định, nên khi chèn item, state không bị chuyển sang row khác.
- `getItemLayout` từ tổng cộng dồn (prefix sum): vị trí được biết mà không cần `onLayout`, kể cả khi chiều cao khác nhau nhưng biết trước.
- `windowSize` và `maxToRenderPerBatch`: thử vài giá trị và đo từng giá trị. Vùng render nhỏ hơn tiết kiệm bộ nhớ và việc của JS nhưng có thể hiện nhiều vùng trắng hơn.
- Ảnh: yêu cầu kích thước gần với kích thước hiển thị nhân mật độ điểm ảnh, nếu CDN của bạn hỗ trợ. Nếu không, mỗi row tải về cả ảnh gốc, và tuỳ nền tảng và thư viện ảnh, nó còn có thể bị decode và cache lớn hơn nhiều so với kích thước hiển thị.

Nếu FlatList vẫn là nút thắt, hãy thử FlashList, thư viện tái sử dụng cell. FlashList v2 cần New Architecture và không còn yêu cầu `estimatedItemSize`. State cục bộ trong row sẽ đi theo cell được tái sử dụng, nên hãy kiểm tra trước.

## Đo lại
Cùng máy, cùng loại build, cùng kịch bản và cùng số lần chạy. Con số ví dụ; trên máy của bạn sẽ khác:
- Perf Monitor: JS FPS giữ trên 50 trong lúc vuốt.
- Profiler: mỗi lần like chỉ có một lần render `FastRow`.
- Flashlight, 5 lần chạy: FPS trung bình 57, CPU của JS thread thấp hơn hẳn mức đỉnh trước đó, điểm 79.
- Video: 6 trên 180 khung hình có cell trống.
- Sau khi resize ảnh, so sánh RAM trong Flashlight hoặc memory profiler của Android Studio qua một lần cuộn dài.

Khi có thể, mỗi lần chỉ đổi một thứ, để biết thay đổi nào có tác dụng.

## Nói trong phỏng vấn
"Tôi dựng lại lỗi giật bằng một kịch bản cuộn trên máy Android tầm trung, release build. Perf Monitor trên debug build cho thấy UI FPS ổn còn JS FPS tụt, nên chi phí nằm ở việc render row. Profiler cho thấy mỗi lần like thì mọi row đều render lại. Tôi memo row, giữ callback ổn định, thêm `keyExtractor` và `getItemLayout` từ chiều cao biết trước, và resize ảnh. Qua 5 lần chạy Flashlight, FPS trung bình tăng từ khoảng 41 lên 57, và số khung hình có vùng trắng giảm rõ rệt."

## Liên quan
`performance-lists-core`, `performance-js-thread-core`, `visible-range`
