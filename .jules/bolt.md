## 2024-08-28 - Optimize `.toLowerCase()` in filtering
**Learning:** Found multiple instances where strings inside `.filter()` were repeatedly converted to lower case for every item, specifically the `searchTerm`.
**Action:** When working on filtering logic inside a react component that iterates over an array, ensure the `searchTerm` (or any invariant value) is converted to lower case *once* before the loop, and use `useMemo` to prevent recalculation on unrelated re-renders.
