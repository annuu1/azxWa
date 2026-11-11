
## 2026-11-11 - Grouping iterations O(N*M)
**Learning:** Found multiple instances where UI arrays were repeatedly filtered inside `.map()` rendering loops for categories or stages, leading to unnecessary O(N*M) computations where N is stages and M is items. In `PipelineBoard`, `leads.filter(l => l.stageId === stageId)` was running inside `stages.map`.
**Action:** When inspecting list or board components, actively look for `.filter()` calls inside `.map()` render loops. These can safely and easily be refactored into a single-pass `useMemo` that builds a `Map` (O(N)), avoiding repeated iterations.
