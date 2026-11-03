
## 2024-11-03 - O(N*M) Filter within Render Loop Optimizations
**Learning:** React components (e.g. `PipelineBoard`) often use unmemoized `array.filter` inside of `.map()` block to segregate flat collections (like `leads`) into related sections (`stages`). This leads to an $O(N \times M)$ recalculation on every render.
**Action:** Replace `leads.filter(l => l.stageId === stage.id)` loops with a `useMemo` that builds a `Map<string, typeof leads>` grouping the items in $O(N)$ time. Then perform an $O(1)$ lookup inside the loop (`map.get(stage.id) || []`). Ensure type safety by using `typeof collection` instead of `any[]` for the Map value type.
