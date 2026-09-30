## Task
Write `mapLimit(items, limit, fn)`: call `fn` for every item, never with more than `limit` calls in flight, and return the results in input order.

As soon as a slot frees up, start the next item; do not wait for a whole batch.

## Real case
Upload 40 photos from the camera roll with at most 3 requests in parallel, so the mobile network does not choke and the server does not throttle you.

## Example
```ts
const urls = await mapLimit(photos, 3, (photo) => upload(photo));
// urls[i] is the result for photos[i]
```

## Rules
- An empty list resolves to `[]` without calling `fn`.
- If `fn` rejects, `mapLimit` rejects with that error.
