## 2026-10-14 - O(N*M) Filtering in Render Loops
**Learning:** React components containing multiple map and filter combinations per render cycle, particularly iterating over the same arrays multiple times (e.g. `leads.filter` inside `stages.map`), are common in this application's list/board views.
**Action:** Always scan for unmemoized `Array.filter` calls inside `map` loops during render. Refactor them using `useMemo` and a `Map` to group items once per update, reducing time complexity from O(N*M) to O(N+M) while keeping types and logic identical.
