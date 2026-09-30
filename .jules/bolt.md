## 2024-09-30 - Optimize O(N*M) list rendering in CRM Pipeline

**Learning:** The CRM features (specifically `PipelineBoard`) suffer from O(N*M) array filtering loops (e.g., repeatedly calling `leads.filter(l => l.stageId === stage.id)` for every stage on every render). This pattern is a prime candidate for `useMemo` grouping.

**Action:** When inspecting components rendering grouped lists, look for inner `Array.prototype.filter` calls within `Array.prototype.map` blocks. Replace them with a single O(N) pre-pass that groups items into a `Map` using `useMemo`, retrieving them via `O(1)` map lookups during the render map.
