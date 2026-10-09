
## 2024-10-09 - Pipeline Board Render Optimization
**Learning:** `src/features/crm/components/pipeline-board.tsx` was performing an O(N*M) calculation on every render by doing an inline `.filter` over all leads for each stage.
**Action:** When working with dashboard or board components that group items by stages or categories, ensure `useMemo` is used along with a lookup table like `Map` to reduce the complexity to O(N) when mapping data structures to columns. This improves responsiveness significantly when there are hundreds of leads.

## 2024-10-09 - GitHub CI Actions with Missing Tests
**Learning:** GitHub Actions using `npm test` will fail and block the pipeline if `package.json` does not configure a test script. This is common in projects initialized without test frameworks.
**Action:** When updating CI pipelines in this repository, ensure `npm run test --if-present` is used instead of `npm test` so that the pipeline gracefully skips tests if none exist, rather than failing.
