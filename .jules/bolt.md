## 2024-05-30 - O(N*M) Render Bottleneck in Pipeline Board
**Learning:** `src/features/crm/components/pipeline-board.tsx` was doing an $O(N \times M)$ operation on every render by mapping over `stages` and repeatedly calling `.filter()` on `leads` for each stage.
**Action:** Replace inline repeated array filters within render loops with a single `useMemo` that groups data into an $O(1)$ lookup `Map` (e.g., grouping leads by stageId). This pattern is extremely effective and safe for board/kanban views.
