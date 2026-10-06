---
id: render-memo-lab
topic: render/memo
kind: lab
readMinutes: 10
---
# Chứng minh bản sửa memo bằng Profiler

## Tình huống
Một màn hình sản phẩm có ô tìm kiếm ở trên và một `FlatList` sản phẩm ở dưới. Ô tìm kiếm chỉ hiện một dải gợi ý; danh sách không đổi khi người dùng gõ. Vậy mà người dùng vẫn thấy gõ bị khựng. Cùng màn hình đó đọc giỏ hàng từ Redux bằng một selector tạo object mới. Bạn sẽ dựng lại cả hai lỗi, đếm số lần render, sửa, rồi đếm lại, để có thể nói "đã hiệu quả" bằng bằng chứng thay vì cảm giác.

## Dựng lại lỗi
Dán đoạn này vào một app thử. Lỗi được cố ý để lại.

```ts
import React, { Profiler, useState, type ProfilerOnRenderCallback } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useSelector } from 'react-redux';

type Product = { id: string; name: string; price: number };
type RootState = { cart: { count: number; total: number } };

export const stats = { screenCommits: 0, screenMs: 0, rowRenders: 0 };

const onScreenRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
  stats.screenCommits += 1;
  stats.screenMs += actualDuration;
};
const onRowRender: ProfilerOnRenderCallback = () => {
  stats.rowRenders += 1;
};

function ProductRow({ item, onPress }: { item: Product; onPress: () => void }) {
  return (
    <Profiler id="row" onRender={onRowRender}>
      <Pressable onPress={onPress}>
        <Text>{item.name} {item.price}</Text>
      </Pressable>
    </Profiler>
  );
}

export function ProductsScreen({ products, open }: { products: Product[]; open: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const cart = useSelector((s: RootState) => ({ count: s.cart.count, total: s.cart.total }));
  return (
    <Profiler id="screen" onRender={onScreenRender}>
      <View style={{ flex: 1 }}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search" />
        <Text>{cart.count} items</Text>
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <ProductRow item={{ ...item, price: item.price / 100 }} onPress={() => open(item.id)} />
          )}
        />
      </View>
    </Profiler>
  );
}
```

Cho nó vài trăm sản phẩm. Thêm một nút chỉ dùng trong dev, chạy `console.log(stats)` rồi reset bộ đếm, để mỗi lần đo bắt đầu từ 0.

`Profiler` bên trong row chỉ báo khi `ProductRow` thật sự chạy. Nếu memo bỏ qua row thì cả subtree của nó, gồm cả `Profiler`, cũng bị bỏ qua, nên `rowRenders` đếm đúng số lần row render.

## Đo
- Mở React Native DevTools. Từ RN 0.76 đây là debugger mặc định: bấm `j` trong terminal Metro hoặc dùng dev menu. Nó có sẵn hai panel Components và Profiler của React DevTools.
- Trong phần cài đặt của React DevTools, bật "Record why each component rendered while profiling". Bật thêm "Highlight updates when components render".
- Bắt đầu ghi trong Profiler, gõ mười ký tự vào ô tìm kiếm, rồi dừng.
- Reset bộ đếm, gõ lại đúng mười ký tự đó, rồi log `stats`.
- Với ca Redux, reset lần nữa rồi dispatch năm lần một action không đụng tới `cart`, ví dụ từ một nút dev.

Về build: Profiler của DevTools và `<Profiler>` chạy được trên development build. Trên production build, React tắt profiling, và bạn cần profiling build của React để có số thời gian; cách bật tuỳ theo setup, nên hãy tra tài liệu của phiên bản RN bạn dùng thay vì đoán. Số lần render đến từ cùng một logic của React ở mọi build, nên tin được trên dev. Thời gian trên dev build bị đội lên vì các kiểm tra của development: chỉ so trước và sau trên cùng một build, và đánh giá cảm nhận thật (gõ có trễ không, có rớt frame không) trên release build.

## Đọc tín hiệu
Con số ví dụ từ một lần chạy (máy của bạn sẽ cho số khác):
- Biểu đồ commit có 10 commit, mỗi phím một commit, mỗi commit khoảng 18 ms trên dev build.
- `stats` cho `screenCommits: 10`, `rowRenders: 300`: khoảng 30 row đang mount trong lần chạy này, row nào cũng render ở mỗi phím. FlatList chỉ mount một cửa sổ row; số lượng phụ thuộc `initialNumToRender`, `windowSize` và chiều cao row, nên số của bạn có thể cao hơn nhiều.
- Chọn một `ProductRow` trong một commit. "Why did this render?" ghi là component cha đã render, hoặc prop `item` và `onPress` đã đổi.
- Khi bật highlight, mọi row đang hiện đều nháy khi bạn gõ.
- Năm action Redux không liên quan cho `screenCommits: 5` và thêm 150 lần row render. react-redux 8.1 trở lên còn cảnh báo một lần ở development, ngay lần đầu selector như vậy chạy, rằng nó trả về kết quả khác cho cùng một input.

Ý nghĩa: danh sách re-render vì `query` nằm cùng component với danh sách, và mỗi row nhận `item` và `onPress` mới ở mỗi lần render. Riêng `useSelector` so kết quả bằng `===`, mà object tạo trong selector thì không bao giờ bằng, nên dispatch nào cũng làm cả màn hình re-render.

## Sửa
Chuyển state tìm kiếm xuống một component riêng, để mỗi phím chỉ render component đó:

```ts
function SearchBar() {
  const [query, setQuery] = useState('');
  return <TextInput value={query} onChangeText={setQuery} placeholder="Search" />;
}
```

Sau đó làm cho row có thể bỏ qua khi màn hình thật sự render. Giữ identity của item, đưa cho row một callback ổn định, và bọc memo:

```ts
const ProductRow = React.memo(function ProductRow({ item, onOpen }: { item: Product; onOpen: (id: string) => void }) {
  return (
    <Profiler id="row" onRender={onRowRender}>
      <Pressable onPress={() => onOpen(item.id)}>
        <Text>{item.name} {(item.price / 100).toFixed(2)}</Text>
      </Pressable>
    </Profiler>
  );
});

// inside ProductsScreen
const renderItem = useCallback(
  ({ item }: { item: Product }) => <ProductRow item={item} onOpen={open} />,
  [open],
);
```

Cách này chỉ ổn định khi chính `open` ổn định ở component cha, nên kiểm tra cả nó. Với selector, mỗi `useSelector` trả về một giá trị, hoặc giữ object và truyền `shallowEqual` của `react-redux` làm tham số thứ hai:

```ts
const cart = useSelector(
  (s: RootState) => ({ count: s.cart.count, total: s.cart.total }),
  shallowEqual,
);
```

Nếu object là dữ liệu dẫn xuất, ví dụ một mảng đã lọc, hãy dùng selector có memo từ `createSelector` của Reselect, vì `shallowEqual` không nhìn được vào bên trong một mảng mới.

Nếu bạn dùng React Compiler, nó có thể tự chèn phần lớn memoization này. Nó không chuyển state xuống giúp bạn, và tự nó không chứng minh được gì: vẫn kiểm chứng bằng Profiler như trên.

## Đo lại
Lặp lại đúng các bước cũ: cùng build, cùng máy, mười ký tự, năm action. Vẫn là con số ví dụ, không phải mục tiêu:
- Gõ phím: Profiler có 10 commit, nhưng mỗi commit chỉ chứa `SearchBar`, dưới 1 ms. `rowRenders` giữ ở 0. `screenCommits` vẫn là 10, vì `SearchBar` nằm trong `Profiler` của màn hình, nhưng `screenMs` giảm từ khoảng 180 ms tổng cộng xuống dưới 10 ms. Highlight chỉ nháy ô nhập.
- Redux: năm action không liên quan cho `screenCommits: 0`. Một thay đổi giỏ hàng thật cho một commit của màn hình và vẫn 0 lần row render, vì `item` và `onOpen` giữ nguyên identity.
- "Why did this render?" không còn liệt kê các row trong những commit này.

Nếu một row vẫn render, chọn nó và đọc lý do. Prop được nêu tên cho bạn biết tham chiếu nào vẫn còn mới và cần tìm ở đâu.

## Nói trong phỏng vấn
"Tôi đếm vấn đề trước. Với Profiler ghi lý do mỗi component render, gõ mười ký tự cho mười commit và khoảng 300 lần row render, tất cả vì component cha render. Tôi chuyển state tìm kiếm vào component riêng, memo row với item và callback ổn định, và thêm `shallowEqual` cho một selector đang tạo object mới. Ghi lại đúng các bước đó, gõ phím chỉ render thanh tìm kiếm và số lần row render về 0. Tôi so thời gian trên cùng một build và xác nhận gõ đã mượt trên release build."

## Liên quan
`render-memo-core`, `render-memo-pitfalls`, `performance/lists`
