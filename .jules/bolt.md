## 2024-10-23 - Memoizing Inline O(N) Filters Inside Render Loops

**Learning:** The CRM dashboard features render large lists grouped by attributes (like Pipeline stages filtering Leads) where inline `.filter()` is used inside the `.map()` block of the parent rendering stages. This results in $O(N \times M)$ operations per render, where $N$ is total leads and $M$ is total stages.
**Action:** When inspecting list/board components, check if arrays are repeatedly `.filter`ed inside a map loop. Extracting these into a single $O(N)$ pass `useMemo` that builds a `Map` allows $O(1)$ lookups during the render block, safely speeding up rendering without altering functionality. Always infer Map value types using `typeof originalArray` to avoid generic `any[]` typing.
