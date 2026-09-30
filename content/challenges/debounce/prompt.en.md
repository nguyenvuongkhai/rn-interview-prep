## Task
Write `debounce(fn, wait)`. The returned function calls `fn` only after `wait` ms of quiet since the last call, with that last call's arguments.

The returned function also has `cancel()`, which drops the pending call.

## Why interviewers ask
A search box that calls the API on every keystroke floods the network and keeps the JS thread busy. The usual follow-up: where do you call `cancel` when the component unmounts?

## Example
```ts
const search = debounce((q: string) => api.search(q), 300);
search('r');
search('re');
search('rea'); // calls api.search('rea') once, after 300 ms
```

## Rules
- A `wait` of 0 still waits for the next timer; it does not call immediately.
- Tests use a fake clock, so use only `setTimeout` and `clearTimeout`.
