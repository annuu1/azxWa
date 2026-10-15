## 2024-10-15 - Pipeline Board Leads Grouping
**Learning:** The CRM components like `PipelineBoard` iterate over large collections directly inside the render loop, leading to O(N*M) array filtering.
**Action:** Always check `.map` render loops for inline `.filter()` calls. Replacing them with a single `useMemo` grouping map (O(1) lookups) safely and reliably eliminates performance bottlenecks during complex state updates and prevents unnecessary array reference recreation.

## 2024-10-15 - GitHub Actions Testing Script Fix
**Learning:** The default `npm test` script triggered by the existing CI pipelines fails with an exit code 1 because the project lacks a `"test"` script in `package.json`.
**Action:** When creating CI pipeline files or fixing them, remember to use `npm run test --if-present` rather than replacing them with build commands to prevent failures without overriding test checks conceptually.
