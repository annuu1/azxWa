## 2024-05-24 - Array Filtering in Loop (Pipeline Board)
**Learning:** Found a textbook performance issue in `src/features/crm/components/pipeline-board.tsx` where an array of deals (`leads`) was being filtered separately for every column (`stage`) on every render using an O(N*M) approach, which scaled poorly.
**Action:** When inspecting frequently rendered lists or boards, specifically search for arrays being filtered inside a mapping of categories. Always convert these to a `useMemo` backed `Map` lookup for O(N+M) performance.
