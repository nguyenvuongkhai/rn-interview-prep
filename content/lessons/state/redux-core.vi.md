---
id: state-redux-core
topic: state/redux
kind: core
readMinutes: 6
---
## TL;DR
Redux là một store duy nhất, chỉ được cập nhật qua reducer thuần, và mọi thay đổi được phát hiện bằng tham chiếu. Redux Toolkit (RTK) bổ sung Immer, cấu hình store mặc định, async thunk và RTK Query. Phần lớn lỗi Redux thực tế đến từ ba chỗ: tham chiếu đổi khi không nên đổi (re-render thừa), tham chiếu không đổi khi lẽ ra phải đổi (UI bỏ lỡ cập nhật), và state không phải dữ liệu thuần serialize được.

## Cơ chế bên trong
### Reducer và Immer
Reducer là hàm thuần `(state, action) => newState`: không side effect, không `Date.now()`, không mutate. Redux và react-redux so sánh tham chiếu, nên object bị mutate trông như không đổi và UI bỏ lỡ cập nhật. `createSlice` chạy case reducer qua Immer: bạn sửa một draft, Immer tạo state mới với structural sharing, phần bị đổi có tham chiếu mới, phần còn lại giữ nguyên. Mỗi reducer chọn một cách: sửa draft, hoặc return giá trị mới. Làm cả hai thì Immer ném lỗi. Viết `state = initialState` chỉ gán lại biến cục bộ và không có tác dụng; hãy `return initialState`.

### configureStore
`configureStore` thêm thunk, và khi chưa ở production thì thêm kiểm tra immutability và serializability, rồi bật Redux DevTools. Từ RTK 2.x (đi cùng Redux 5 và react-redux 9), `createReducer` và `extraReducers` chỉ nhận builder callback; cú pháp object cũ đã bị bỏ. Giá trị không serialize được như `Date`, `Map`, instance của class hay function sẽ bị cảnh báo, và với redux-persist chúng quay lại dưới dạng JSON thuần sau khi khởi động lại.

### useSelector
`useSelector` chạy lại selector mỗi khi root state đổi và so sánh kết quả bằng `===`. Selector tạo object hay mảng mới (`filter`, `map`, `{ a, b }`) luôn trả về tham chiếu mới, nên component re-render sau mọi action làm đổi bất kỳ slice nào. Từ react-redux 8.1, bản dev cảnh báo khi selector trả về tham chiếu khác cho cùng một input. Cách sửa: chọn từng giá trị primitive riêng, truyền `shallowEqual`, hoặc dùng `createSelector`, chỉ tính lại khi input đổi. Giữ input selector là phép đọc đơn giản, phần tính toán đặt trong result function.

### State chuẩn hoá
`createEntityAdapter` lưu dạng `{ ids, entities }` kèm sẵn reducer và selector. Để list chọn `ids` và mỗi row tự chọn entity của nó theo id: sửa một entity thì chỉ một row re-render.

### Việc bất đồng bộ
`createAsyncThunk` dispatch `pending`, rồi `fulfilled` hoặc `rejected`. `return rejectWithValue(x)` để reject kèm payload; gọi mà quên `return` thì `fulfilled` được dispatch. `condition` có thể bỏ qua một lần gọi. `abort()` chỉ abort `signal`; phải truyền `signal` vào `fetch` thì request mới dừng. `await dispatch(thunk())` không bao giờ ném lỗi nếu bạn không gọi `.unwrap()`. Với dữ liệu server, RTK Query có cache theo endpoint và argument, dedup request, tag để invalidate và `keepUnusedDataFor`. Trên RN, `refetchOnFocus` cần `setupListeners` với handler dùng `AppState`. `createListenerMiddleware` phản ứng theo action hoặc thay đổi state; listener dispatch một action khớp chính predicate của nó sẽ chạy vòng lặp.

## Góc phỏng vấn
- "Vì sao component này re-render ở mọi action?" Nói về `===`, tham chiếu mới từ selector, và cảnh báo của react-redux ở bản dev.
- "Redux, Context, Zustand hay React Query?" Tách server state khỏi client state trước, rồi biện luận Redux bằng state dùng chung có nhiều nơi ghi, logic cập nhật phức tạp và công cụ.
- "redux-persist hay hỏng ở đâu?" Đổi hình dạng state mà không có `createMigrate`, persist quá nhiều, và các action của nó làm `serializableCheck` cảnh báo.

## Lỗi thường gặp
- Vừa sửa draft vừa return giá trị mới trong cùng một reducer
- Gán lại `state` thay vì return giá trị mới
- Selector trả về object hay mảng mới ở mỗi lần chạy
- Gọi `rejectWithValue` mà quên `return`
- Lưu `Date`, `Map` hay instance của class trong state được persist
- Đổi hình dạng của slice được persist mà không viết migration

## Liên quan
`state-async-core`, `state-redux-saga-core`, `render-memo-core`
