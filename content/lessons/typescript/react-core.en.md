---
id: typescript-react-core
topic: typescript/react
kind: core
readMinutes: 6
---
## TL;DR
TypeScript in RN checks the contracts between your components, but only inside the code it can see, and only where `tsc` runs. Metro builds through Babel, which strips types without checking them. Most real bugs come from types that are too narrow (`ViewStyle` instead of `StyleProp<ViewStyle>`), inference that went wrong (`useState([])`), and types that lie about runtime data (casts, unvalidated route params, `{} as Ctx`).

## Under the hood
### Props and children
Type props on the function parameter: `function Card({ title, children }: CardProps)`. Since the React 18 types, `React.FC` no longer adds `children`, so declare `children?: React.ReactNode`, which accepts text, elements, arrays and `null`. `JSX.Element` is too narrow for general children.

To wrap an RN component, extend its props: `ViewProps`, `PressableProps`, or `ComponentProps<typeof X>` for anything without an exported type. Use `Omit` for the props you redefine, then forward the rest with `{...rest}`. A style prop accepted from outside is `StyleProp<ViewStyle>` (or `TextStyle`), which allows arrays and falsy entries; a bare `ViewStyle` is one plain object.

For props that depend on each other, use a discriminated union: `{ variant: 'link'; href: string; onPress?: never } | { variant: 'primary'; onPress: () => void; href?: never }`, and narrow on `props.variant` inside. Generic components such as `List<T>` follow the same rules; see the generics lesson.

### Hooks and refs
`useState` infers from the initial value. Under `strict`, `useState([])` is `never[]` and `useState(null)` is `null`, so write `useState<User[]>([])` and `useState<User | null>(null)`. With `@types/react` 19, `useRef` requires an argument, `useRef<TextInput>(null)` returns `RefObject<TextInput | null>`, and `RefObject.current` is mutable. From React 19 (RN 0.78 and later) a function component receives `ref` as a regular prop, typed for example `ref?: React.Ref<TextInput>`; `forwardRef` still works and is still needed on RN 0.76 and 0.77.

### Events
RN events are `NativeSyntheticEvent<T>` with the payload in `nativeEvent`: `NativeSyntheticEvent<TextInputChangeEventData>` for `onChange`, plus aliases such as `GestureResponderEvent` for `onPress` and `LayoutChangeEvent` for `onLayout`. DOM types such as `React.ChangeEvent` do not apply.

### Context
Create context with `createContext<Value | null>(null)` and expose a hook that throws outside the provider. A default of `{} as Value` makes every consumer look safe and crashes at runtime.

### Navigation
Declare a `RootStackParamList`, type screens with `NativeStackScreenProps<RootStackParamList, 'Profile'>`, and declare `ReactNavigation.RootParamList` globally so `useNavigation()` is typed. This checks `navigate` calls only. Deep links, notifications and restored state are not validated: path params arrive as strings unless the linking config has `parse`.

### Modules and config
Untyped libraries and assets need declarations, for example `declare module '*.png' { const src: number; export default src; }`. Type env values in one module that reads and checks them, not with scattered casts. The template's tsconfig extends `@react-native/typescript-config`; CI must run `tsc --noEmit`, because neither Metro nor the native release build checks types.

## Interview angle
- "How do you type a wrapper around `Pressable`?" Extend `PressableProps`, use `StyleProp`, forward rest props, and say how `ref` is passed on your React version.
- "`tsc` passes but production crashes on bad data. Why?" Types are erased; validate at the boundaries.
- "How do you type navigation?" Param list, screen props, global `RootParamList`, and the runtime gap for deep links.

## Common pitfalls
- `useState([])` or `useState(null)` without a generic
- `style?: ViewStyle` on a component that receives style arrays
- Typing `children` as `JSX.Element`
- A context default of `{} as Value`
- Trusting route params from deep links, or casting API data with `as`
- Relying on Metro or the release build to catch type errors

## Related
`typescript-types-core`, `typescript-generics-core`, `state-redux-core`
