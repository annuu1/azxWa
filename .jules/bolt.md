## 2024-08-27 - Memoize CRM contacts list filtering
**Learning:** Found a list filtering operation executing `searchTerm.toLowerCase()` 3 times per item inside a `.filter` block running on every render in `ContactsList`.
**Action:** Optimized by hoisting string manipulation outside the loop and wrapping with `useMemo`. When dealing with list filtering in Next.js/React applications within this codebase, always check if expensive operations are run inside loops on every render, especially on potentially long contact lists.
