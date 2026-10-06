---
id: performance-lists-lab
topic: performance/lists
kind: lab
readMinutes: 11
---
# Prove a janky feed got faster

## The case
A feed shows 1,000+ posts with an image and some text. Heights differ but are known before rendering, because the API sends each image's aspect ratio. A fast fling stutters and shows blank areas before rows fill in. You must fix it and prove the fix with numbers from the same scripted scroll.

## Reproduce it
Paste this into a test app. It has the usual mistakes: an inline `renderItem` creating a new callback for every row, an unmemoised row, no `keyExtractor` (the field is `postId`, so FlatList falls back to index keys), no `getItemLayout`, and full-size images. `burn` stands in for real row cost.

```ts
import React, { useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';

type Post = { postId: string; text: string; imageUrl: string; height: number };
type RowProps = { post: Post; liked: boolean; onLike: (id: string) => void };

const burn = (ms: number) => { const end = Date.now() + ms; while (Date.now() < end) {} };

function PostRow({ post, liked, onLike }: RowProps) {
  burn(3); // simulated row cost
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

Generate 1,000 posts with heights between 200 and 400 and large photo URLs.

## Measure
Fix the conditions first:
- One physical device, ideally a mid-range Android phone. Emulators do not behave like real hardware.
- A release build for anything you report. Dev builds run extra checks and make JS look far slower.
- One scripted scroll, so every run does the same fling.
- Several runs (three to five) and compare averages.

Tools, in order:
- Perf Monitor: open the Dev Menu and choose Perf Monitor. It shows UI FPS (the native main thread) and JS FPS (the JS thread). It only exists in debug builds, so use it only to see which thread drops during the fling, not as the result.
- React DevTools Profiler: in React Native DevTools (the default debugger from RN 0.76), open the Profiler, turn on the setting that records why each component rendered, record, fling, stop. Count `PostRow` renders and their reasons. Counts are meaningful in dev; durations are not.
- Flashlight: an open-source Android tool from BAM that measures FPS, CPU per thread and RAM on a real device and gives an overall score. `flashlight measure` shows live metrics while you drive the app. `flashlight test` runs a test command several times and averages the results; check `flashlight test --help` for your version's options. On iOS, use Xcode Instruments on a release build.
- Blank areas: screen-record the fling, step through it frame by frame and count frames with an empty cell. It works for any list. FlashList also has a blank-area tracking hook, `useBlankAreaTracker`; see its docs for the current signature.

For the scripted scroll, a Maestro flow is enough: `launchApp`, then a fixed number of `swipe` steps with `direction: UP`. Pass it to `flashlight test` as the test command.

## Read the signal
Example numbers from one mid-range Android phone; yours will differ:
- Perf Monitor during the fling: UI FPS stays near 60, JS FPS falls to 10–20. Native scrolls fine; JS cannot render rows fast enough.
- Profiler: liking one post re-renders every mounted `PostRow`, because each gets a new `onLike` function and none is memoised.
- Flashlight, five runs: average FPS 41, JS thread CPU close to 100% during the swipes, score 48.
- Video: 52 of 180 frames show at least one blank cell.

How to read it:
- UI FPS fine, JS FPS low: the cost is JS work, mostly `renderItem` and its rows. Make rows cheaper first.
- UI FPS low as well: look at native work, such as decoding large images, heavy shadows or deep view trees.
- Blank cells with JS busy: the render window cannot keep up with the fling. Tuning the window hides it; cheaper rows fix it.

## Fix
Make rows cheap and stable, then help FlatList avoid measuring:

```ts
import React, { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, ListRenderItemInfo } from 'react-native';

// same PostRow, burn included, so before and after compare fairly
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

What each change does:
- `memo` plus a stable `onLike`: after a like, only the row whose `liked` changed renders again.
- `keyExtractor` with `postId`: stable identity, so inserts do not move state between rows.
- `getItemLayout` from prefix sums: positions are known without `onLayout`, even for variable heights known up front.
- `windowSize` and `maxToRenderPerBatch`: try a few values and measure each. A smaller window saves memory and JS work but can show more blanks.
- Images: request a size close to the displayed size times the pixel density, if your CDN supports it. Otherwise every row downloads the full photo, and depending on the platform and image library it may also be decoded and cached far larger than it is shown.

If FlatList is still the bottleneck, try FlashList, which recycles cells. FlashList v2 needs the New Architecture and no longer asks for `estimatedItemSize`. Local state in rows travels with recycled cells, so check for it.

## Measure again
Same device, build type, script and number of runs. Example numbers; yours will differ:
- Perf Monitor: JS FPS stays above 50 during the fling.
- Profiler: one `FastRow` render per like.
- Flashlight, five runs: average FPS 57, JS thread CPU well below its earlier peak, score 79.
- Video: 6 of 180 frames show a blank cell.
- After resizing images, compare RAM in Flashlight or the Android Studio memory profiler over a long scroll.

Change one thing at a time where you can, so you know what paid off.

## Say it in the interview
"I reproduced the stutter with a scripted scroll on a mid-range Android phone, release build. Perf Monitor in a debug build showed UI FPS fine and JS FPS dropping, so rendering rows was the cost. The Profiler showed every row re-rendering on each like. I memoised the row, made callbacks stable, added `keyExtractor` and `getItemLayout` from known heights, and resized images. Over five Flashlight runs the average FPS went from about 41 to 57, and blank frames dropped sharply."

## Related
`performance-lists-core`, `performance-js-thread-core`, `visible-range`
