## 2024-09-08 - Memoizing Array Filtering in React Renders
**Learning:** In CRM dashboard components like `PipelineBoard`, nested loops mapping over `stages` and filtering `leads` (O(N*M)) occur on every render, which is triggered often by local loading state changes (`loadingLeadId`).
**Action:** Always check array filtering (`.filter()`) inside `.map()` loops. Group them into a lookup `Map` using `useMemo` when both lists are provided as props and local state causes frequent re-renders. This transforms O(N*M) to O(N) map generation + O(1) lookup.
