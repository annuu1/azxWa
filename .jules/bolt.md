## 2024-10-15 - Pipeline Board Leads Grouping
**Learning:** The CRM components like `PipelineBoard` iterate over large collections directly inside the render loop, leading to O(N*M) array filtering.
**Action:** Always check `.map` render loops for inline `.filter()` calls. Replacing them with a single `useMemo` grouping map (O(1) lookups) safely and reliably eliminates performance bottlenecks during complex state updates and prevents unnecessary array reference recreation.
