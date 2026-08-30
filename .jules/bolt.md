## 2024-08-30 - useMemo around CRM contacts search list
**Learning:** Found an $O(N)$ text transformation loop running repeatedly on every re-render in the CRM dashboard contacts list.
**Action:** When inspecting list and table rendering code, look for operations like string parsing/transformation taking place inside `.filter()` blocks and memoize them.
