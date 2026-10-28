
## 2023-10-28 - Pipeline Board Map Lookup Optimization
**Learning:** The CRM dashboard features O(N*M) nested render loops in `.map()` containing `.filter()` operations over changing lists (like `pipeline-board.tsx`), causing heavy re-calculation on every re-render.
**Action:** When working on similar dashboard components, check for inline data filtering and group data ahead of time using an O(1) Map inside a `useMemo` hook to skip recalculation on unrelated re-renders.
