## 2024-05-30 - O(N*M) Rendering Loops
**Learning:** Found O(N*M) complexity in `src/features/crm/components/pipeline-board.tsx` due to `getLeadsForStage` iterating over all `leads` for every `stage`.
**Action:** Always check `.map` iterations in React rendering arrays. When dealing with stages or categories, memoize a single `Map` of groupings rather than running `.filter` inside the loop.
