
## 2023-10-24 - O(N*M) Filtering on Pipeline Boards
**Learning:** In CRM dashboard components like `pipeline-board.tsx`, the codebase maps over pipeline `stages` (M) and repeatedly filters the entire `leads` array (N) inline on every render (`leads.filter(l => l.stageId === stageId)`). This results in O(N*M) work during render.
**Action:** When optimizing lists grouped by a foreign key (like stage or status), safely pre-group the items into a `Map` using `useMemo` so that lookups per group render become O(1), improving render time from O(N*M) to O(N + M). Use `typeof leads` to satisfy type checking cleanly.
