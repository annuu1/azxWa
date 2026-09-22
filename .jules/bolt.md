## 2024-03-24 - Grouping Leads by Stage with O(1) Map Lookups
**Learning:** In Kanban-style or pipeline boards (like `src/features/crm/components/pipeline-board.tsx`), repeatedly filtering arrays on every render for multiple stages can lead to O(N*M) rendering bottlenecks.
**Action:** Replace `array.filter(l => l.stageId === stageId)` with a `useMemo` grouped `Map` lookup keyed by `stageId` to change this into a single O(N) pass, maintaining an O(1) lookup on render.
