## 2024-05-18 - Optimized Pipeline Board Rendering
**Learning:** The `src/features/crm/components/` codebase has O(N*M) rendering bottlenecks where arrays are filtered multiple times per render (e.g. `leads.filter(l => l.stageId === stageId)` inside `stages.map`).
**Action:** Replace repeated `.filter` calls within render loops with a single-pass O(N) grouping using `Map` memoized by `useMemo`. This pattern is safe and very effective in this application's dashboards.
