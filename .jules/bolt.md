## 2024-10-20 - O(N*M) Rendering Bottlenecks in CRM Features
**Learning:** The CRM components, particularly `pipeline-board.tsx`, frequently use inline array operations like `.filter()` inside map iterations during rendering. This results in O(N*M) time complexity every time the component renders.
**Action:** Always check rendering loops (like stage mappings) for unmemoized nested iteration over large collections (like `leads`). Replace these with a `useMemo` backed by a `Map` to reduce complexity from O(N*M) to O(N).
