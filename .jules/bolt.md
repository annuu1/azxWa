## 2024-05-24 - Extracted invariant string operations from React filter loops
**Learning:** Found an O(N) performance anti-pattern in `ContactsList` where `searchTerm.toLowerCase()` was executed three times per item inside a `.filter` array method during rendering.
**Action:** When inspecting list/table components rendering large arrays, actively look for static derivations (like lowercasing search terms) that can be computed once before the loop, and wrap expensive derived state in `useMemo` where appropriate.
