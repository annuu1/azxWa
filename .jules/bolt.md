## 2024-05-18 - CRM Pipeline Array Filtering Optimization
**Learning:** `src/features/crm/components/` (e.g., `pipeline-board.tsx`) rendered collections by re-filtering an array on every render loop within `.map` blocks. This resulted in O(N*M) rendering bottlenecks for the lead board.
**Action:** When inspecting list/board style component files, check if an array filter iterates the full data list repeatedly. Use `useMemo` combined with a `Map` structure to reduce this to an O(N) map construction and O(1) lookups during rendering.
## 2024-05-18 - CI Failures for missing NPM test script
**Learning:** `npm test` fails GitHub CI actions if the target `package.json` file completely lacks a `"test"` script.
**Action:** Always replace `npm test` with `npm run test --if-present` in workflow files like `.github/workflows/push.yml` or `.github/workflows/pull_request.yml` when the application currently has no tests defined, instead of deleting the step or changing it to `npm run build`.
