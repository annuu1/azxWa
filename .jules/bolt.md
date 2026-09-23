## 2024-11-XX - PipelineBoard O(N*M) Render Fix
**Learning:** The `PipelineBoard` component previously used an O(N) array filter for leads within an O(M) mapping of stages during rendering, which scales poorly.
**Action:** Replaced inline array filters inside loops with O(1) Lookups using `useMemo` and `Map`.
