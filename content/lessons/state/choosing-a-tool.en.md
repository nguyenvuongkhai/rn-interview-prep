---
id: state-global-choosing-a-tool
topic: state/global
kind: core
readMinutes: 5
---
## TL;DR
A senior answer doesn't pick one tool for everything. **Split state by type**, then pick the right tool for each.

| State type | Examples | Good tools |
| --- | --- | --- |
| Server state | Products, profile, orders from the API | TanStack Query, RTK Query |
| Global client state | Cart, auth session, app settings | Redux Toolkit or Zustand |
| Rarely changing values | Theme, locale, current user | Context API |
| Local UI state | Form inputs, modal open, selected tab | `useState`, `useReducer` |

## Under the hood
- **Redux Toolkit:** one-way data flow, excellent DevTools, middleware, clear conventions for large teams. Pairs with **Redux-Saga** for complex async flows (cancellation, retries, sequences of actions). More structure, more code.
- **Zustand:** tiny API, almost no boilerplate. Components subscribe through **selectors**, so they re-render only when their slice changes.
- **Context:** not really a state manager. When its value changes, **every consumer re-renders**, even one that reads a single field. Splitting contexts or memoizing the value helps, but frequently changing state belongs elsewhere.

## Interview angle
- "Which do you prefer?" Answer by state type, then name the tool for each type.
- "Why not Context for everything?" Every consumer re-renders on any change.
- "Redux-Saga or RTK Query?" RTK Query for plain fetching and caching; sagas for long-running or cancellable flows.

## Common pitfalls
- Storing API data in Redux by hand and rewriting caching and loading flags yourself
- One big Context for the whole app
- Expecting `React.memo` to stop context-driven re-renders

## Related
`render/memo`
