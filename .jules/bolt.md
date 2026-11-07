
## 2024-05-14 - Inline array filters in component renders
**Learning:** Found O(N*M) rendering bottleneck in `src/features/knowledge-base/components/kb-panel.tsx` caused by unmemoized `.filter()` calls using `.toLowerCase()` repeatedly in components that update frequently on text input.
**Action:** Always check array iteration and inline calculations inside components doing filtering when typing, extract `toLowerCase()` logic out of the loops, and memoize results with `useMemo`.
