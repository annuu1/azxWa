## 2024-05-30 - O(N*M) Render Bottleneck in Pipeline Board
**Learning:** `src/features/crm/components/pipeline-board.tsx` was doing an $O(N \times M)$ operation on every render by mapping over `stages` and repeatedly calling `.filter()` on `leads` for each stage.
**Action:** Replace inline repeated array filters within render loops with a single `useMemo` that groups data into an $O(1)$ lookup `Map` (e.g., grouping leads by stageId). This pattern is extremely effective and safe for board/kanban views.
## 2024-05-30 - CI test failure on repo with no tests
**Learning:** The project lacks an `npm test` script, causing CI workflows (`.github/workflows/pull_request.yml` and `push.yml`) to fail with exit code 1 when attempting to run `npm test`.
**Action:** Always replace `npm test` with `npm run test --if-present` in GitHub Action workflows when working in this codebase, rather than creating a dummy test script.
