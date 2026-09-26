
## 2024-05-24 - [O(N*M) Rendering Bottlenecks]
**Learning:** The codebase frequently uses unmemoized inline array operations inside component render loops (e.g., calling `.filter` over an array inside a `.map` iterator, like in `pipeline-board.tsx`).
**Action:** When inspecting components with inner loops or lists over lists, look for redundant list filtering. Converting these to an upfront O(N) `Map` construction via `useMemo` is a proven, safe performance optimization strategy.
