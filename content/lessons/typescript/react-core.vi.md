---
id: typescript-react-core
topic: typescript/react
kind: core
readMinutes: 6
---
## TL;DR
TypeScript trong RN kiểm tra hợp đồng giữa các component, nhưng chỉ trong phần code nó nhìn thấy, và chỉ ở nơi `tsc` được chạy. Metro build qua Babel, vốn xoá kiểu mà không kiểm tra. Phần lớn lỗi thực tế đến từ kiểu quá hẹp (`ViewStyle` thay vì `StyleProp<ViewStyle>`), suy kiểu sai (`useState([])`), và kiểu nói dối về dữ liệu lúc runtime (ép kiểu, route params không được kiểm tra, `{} as Ctx`).

## Cơ chế bên trong
### Props và children
Khai báo kiểu props ngay trên tham số: `function Card({ title, children }: CardProps)`. Từ type của React 18, `React.FC` không còn tự thêm `children`, nên hãy khai báo `children?: React.ReactNode`, kiểu nhận text, element, mảng và `null`. `JSX.Element` quá hẹp cho children nói chung.

Khi bọc một component của RN, hãy extend props của nó: `ViewProps`, `PressableProps`, hoặc `ComponentProps<typeof X>` cho component không export kiểu. Dùng `Omit` cho những prop bạn định nghĩa lại, rồi chuyển phần còn lại xuống bằng `{...rest}`. Prop style nhận từ ngoài là `StyleProp<ViewStyle>` (hoặc `TextStyle`), kiểu cho phép mảng và giá trị falsy; `ViewStyle` trần chỉ là một object.

Với các prop phụ thuộc nhau, dùng discriminated union: `{ variant: 'link'; href: string; onPress?: never } | { variant: 'primary'; onPress: () => void; href?: never }`, rồi narrow theo `props.variant` bên trong. Generic component như `List<T>` theo cùng quy tắc; xem bài về generics.

### Hook và ref
`useState` suy kiểu từ giá trị khởi tạo. Với `strict`, `useState([])` là `never[]` và `useState(null)` là `null`, nên hãy viết `useState<User[]>([])` và `useState<User | null>(null)`. Với `@types/react` 19, `useRef` bắt buộc có tham số, `useRef<TextInput>(null)` trả về `RefObject<TextInput | null>`, và `RefObject.current` mutable. Từ React 19 (RN 0.78 trở lên), function component nhận `ref` như một prop bình thường, ví dụ khai báo `ref?: React.Ref<TextInput>`; `forwardRef` vẫn chạy, và vẫn cần trên RN 0.76 và 0.77.

### Event
Event của RN là `NativeSyntheticEvent<T>` với dữ liệu nằm trong `nativeEvent`: `NativeSyntheticEvent<TextInputChangeEventData>` cho `onChange`, cùng các alias như `GestureResponderEvent` cho `onPress` và `LayoutChangeEvent` cho `onLayout`. Kiểu của DOM như `React.ChangeEvent` không dùng được.

### Context
Tạo context bằng `createContext<Value | null>(null)` và cung cấp một hook ném lỗi khi dùng ngoài provider. Giá trị mặc định `{} as Value` làm mọi consumer trông an toàn, rồi crash lúc runtime.

### Navigation
Khai báo `RootStackParamList`, định kiểu màn hình bằng `NativeStackScreenProps<RootStackParamList, 'Profile'>`, và khai báo global `ReactNavigation.RootParamList` để `useNavigation()` có kiểu. Việc này chỉ kiểm tra các lời gọi `navigate`. Deep link, notification và state được khôi phục không được kiểm tra: path param đến dưới dạng string nếu linking config không có `parse`.

### Module và cấu hình
Thư viện không có kiểu và file asset cần khai báo, ví dụ `declare module '*.png' { const src: number; export default src; }`. Định kiểu biến môi trường trong một module duy nhất đọc và kiểm tra chúng, thay vì ép kiểu rải rác. tsconfig của template extend `@react-native/typescript-config`; CI phải chạy `tsc --noEmit`, vì cả Metro lẫn build native bản release đều không kiểm tra kiểu.

## Góc phỏng vấn
- "Bạn định kiểu một wrapper quanh `Pressable` thế nào?" Extend `PressableProps`, dùng `StyleProp`, chuyển rest props xuống, và nói cách truyền `ref` theo phiên bản React đang dùng.
- "`tsc` pass mà production crash vì dữ liệu sai. Tại sao?" Kiểu bị xoá; hãy kiểm tra ở ranh giới.
- "Bạn định kiểu navigation thế nào?" Param list, screen props, global `RootParamList`, và khoảng trống lúc runtime với deep link.

## Lỗi thường gặp
- `useState([])` hoặc `useState(null)` mà không có generic
- `style?: ViewStyle` trên component nhận mảng style
- Định kiểu `children` là `JSX.Element`
- Giá trị mặc định của context là `{} as Value`
- Tin route params từ deep link, hoặc ép kiểu dữ liệu API bằng `as`
- Trông chờ Metro hay build release bắt lỗi kiểu

## Liên quan
`typescript-types-core`, `typescript-generics-core`, `state-redux-core`
