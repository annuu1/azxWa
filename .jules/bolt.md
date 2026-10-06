## 2024-05-18 - CRM Pipeline Array Filtering Optimization
**Learning:** `src/features/crm/components/` (e.g., `pipeline-board.tsx`) rendered collections by re-filtering an array on every render loop within `.map` blocks. This resulted in O(N*M) rendering bottlenecks for the lead board.
**Action:** When inspecting list/board style component files, check if an array filter iterates the full data list repeatedly. Use `useMemo` combined with a `Map` structure to reduce this to an O(N) map construction and O(1) lookups during rendering.
