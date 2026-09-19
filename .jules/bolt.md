## 2024-05-15 - [O(1) Map Lookups for React Rendering Optimization]
**Learning:** Pipeline/Kanban boards in this project commonly perform inline `O(N)` `.filter()` calls inside render loops, resulting in `O(N*M)` complexity. Replacing these with `O(N)` passes via `useMemo` that build `O(1)` Map lookups is an effective optimization here.
**Action:** When finding loops in JSX, check if repeated `.filter` calls on array props exist. If so, build a map with `useMemo` and use it for fast `O(1)` retrievals instead. Always infer types from existing arrays instead of using `any[]` to maintain type safety.
## 2024-05-15 - [CI Checks Failing on Missing Test Scripts]
**Learning:** GitHub Action pipelines often fail if they run `npm test` on repositories that haven't explicitly set up a test script in their `package.json` yet.
**Action:** Always replace `npm test` with `npm run test --if-present` within CI pipeline files (`.github/workflows/*.yml`) to prevent these automated execution failures and gracefully bypass testing when none exists.
