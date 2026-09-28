## 2024-10-30 - Pipeline board render optimization
**Learning:** The pipeline board component repeatedly filtered a single array `leads` inside a loop iterating through `stages`, leading to O(N*M) runtime complexity in rendering.
**Action:** When working with rendering rows, Kanban boards, or structured grids derived from single flat arrays, Bolt should prefer a `useMemo` calculation grouping objects by category via a map structure for O(1) lookups during the component render cycle.
