
## 2024-10-09 - Pipeline Board Render Optimization
**Learning:** `src/features/crm/components/pipeline-board.tsx` was performing an O(N*M) calculation on every render by doing an inline `.filter` over all leads for each stage.
**Action:** When working with dashboard or board components that group items by stages or categories, ensure `useMemo` is used along with a lookup table like `Map` to reduce the complexity to O(N) when mapping data structures to columns. This improves responsiveness significantly when there are hundreds of leads.
