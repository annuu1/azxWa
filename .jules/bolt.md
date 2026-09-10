## 2024-09-10 - Extracted string operations inside `.filter` loops
**Learning:** Found an instance in `src/features/crm/components/contacts-list.tsx` where string operations like `toLowerCase()` were executed inside `.filter()` for every contact upon every render.
**Action:** Extract expensive operations outside iterative loops and memoize the array derivations when appropriate.
