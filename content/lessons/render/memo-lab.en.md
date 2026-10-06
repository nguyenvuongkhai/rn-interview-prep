---
id: render-memo-lab
topic: render/memo
kind: lab
readMinutes: 10
---
# Proving a memo fix with the Profiler

## The case
A product screen has a search box at the top and a `FlatList` of products below. The search box only fills a suggestion strip; the list does not change while the user types. Users still say typing feels sticky. The same screen reads the cart from Redux with a selector that builds a new object. You will reproduce both problems, count the renders, fix them, and count again, so that you can say "it worked" with evidence instead of a feeling.

## Reproduce it
Paste this into a test app. The bugs are deliberate.

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

Give it a few hundred products. Add a dev-only button that runs `console.log(stats)` and resets the counters, so each measurement starts from zero.

The `Profiler` inside the row only reports when `ProductRow` actually runs. If memo skips the row, its subtree, `Profiler` included, is skipped, so `rowRenders` counts real row renders.

## Measure
- Open React Native DevTools. From RN 0.76 it is the default debugger: press `j` in the Metro terminal or use the dev menu. It includes the React DevTools Components and Profiler panels.
- In the React DevTools settings, turn on "Record why each component rendered while profiling". Turn on "Highlight updates when components render" as well.
- Start recording in the Profiler, type ten characters into the search box, then stop.
- Reset the counters, type the same ten characters, and log `stats`.
- For the Redux case, reset again and dispatch an action that does not touch `cart` five times, for example from a dev button.

On builds: the DevTools Profiler and `<Profiler>` work in a development build. In a production build React turns profiling off, and you need React's profiling build to get timings; how to enable it depends on your setup, so check the docs for your RN version rather than assume. Render counts come from the same React logic in any build, so you can trust them in dev. Durations in a dev build are inflated by development checks: compare them only before and after in the same build, and judge the felt result (typing lag, dropped frames) in a release build.

## Read the signal
Example numbers from one run (your machine will show different ones):
- The commit chart shows 10 commits, one per keystroke, each around 18 ms in the dev build.
- `stats` shows `screenCommits: 10`, `rowRenders: 300`: about 30 mounted rows in this run, each rendered on every keystroke. FlatList only mounts a window of rows; how many depends on `initialNumToRender`, `windowSize` and row height, so your count may be much higher.
- Select a `ProductRow` in a commit. "Why did this render?" says the parent component rendered, or that the props `item` and `onPress` changed.
- With highlighting on, every visible row flashes while you type.
- Five unrelated Redux actions give `screenCommits: 5` and another 150 row renders. react-redux 8.1 and later also warn once in development, the first time such a selector runs, that it returned a different result for the same input.

What this means: the list re-renders because `query` lives in the same component as the list, and every row gets a new `item` and `onPress` each time. Separately, `useSelector` compares the result with `===`, and an object built inside the selector is never equal, so any dispatch re-renders the whole screen.

## Fix
Move the search state down into its own component, so a keystroke renders only that component:

```ts
function SearchBar() {
  const [query, setQuery] = useState('');
  return <TextInput value={query} onChangeText={setQuery} placeholder="Search" />;
}
```

Then make the rows skippable when the screen does render. Keep item identity stable, give the row a stable callback, and memo it:

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

This only stays stable if `open` itself is stable in the parent, so check it too. For the selector, return one value per `useSelector`, or keep the object and pass `shallowEqual` from `react-redux` as the second argument:

```ts
const cart = useSelector(
  (s: RootState) => ({ count: s.cart.count, total: s.cart.total }),
  shallowEqual,
);
```

If the object is derived data, such as a filtered array, use a memoised selector from Reselect's `createSelector` instead, since `shallowEqual` cannot see inside a new array.

If you use React Compiler, it can insert much of this memoisation for you. It cannot move state down, and it does not prove anything on its own: verify with the Profiler the same way.

## Measure again
Repeat exactly the same steps: same build, same device, ten characters, five actions. Example numbers again, not targets:
- Typing: the Profiler shows 10 commits, but each one contains only `SearchBar`, under 1 ms. `rowRenders` stays at 0. `screenCommits` is still 10, because `SearchBar` sits inside the screen's `Profiler`, but `screenMs` drops from about 180 ms in total to under 10 ms. Highlighting flashes only the input.
- Redux: five unrelated actions give `screenCommits: 0`. A real cart change gives one screen commit and still 0 row renders, because `item` and `onOpen` keep their identity.
- "Why did this render?" no longer lists the rows in these commits.

If a row still renders, select it and read the reason. The prop it names tells you which reference is still new and where to look.

## Say it in the interview
"I first counted the problem. With the Profiler recording why each component rendered, typing ten characters gave ten commits and about 300 row renders, all because the parent rendered. I moved the search state into its own component, memoised the row with a stable item and callback, and added `shallowEqual` to a selector that built a new object. Recording the same steps again, typing rendered only the search bar and row renders dropped to zero. I compared timings in the same build and confirmed the typing felt smooth in a release build."

## Related
`render-memo-core`, `render-memo-pitfalls`, `performance/lists`
