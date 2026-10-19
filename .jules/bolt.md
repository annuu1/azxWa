## 2024-10-19 - Avoid O(N*M) Rendering in Lists
**Learning:** This codebase frequently maps over outer arrays (like pipeline stages) and performs inline `.filter()` calls on inner arrays (like leads) within the render loop. This causes O(N*M) rendering bottlenecks where arrays are re-filtered on every keystroke or render.
**Action:** When inspecting frequently rendered lists or boards in `src/features/`, check for inline unmemoized array iterations (`filter`, `find`) inside `.map()` loops. Replace them with `useMemo` hooks that build an O(1) `Map` or grouped dictionary lookup structure.
