## 2024-10-27 - [Pipeline Board React Re-Render Optimization]
**Learning:** `src/features/crm/components/` (e.g. `pipeline-board.tsx`) often contains inner-loop `.filter()` arrays during large parent map operations, causing O(N*M) render complexity.
**Action:** Always scan for unmemoized O(N*M) loops in React renders and safely refactor to `useMemo` combined with an O(1) `Map` lookup, ensuring types are inferred properly rather than using `any[]`.
