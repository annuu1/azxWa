## 2024-08-30 - Prevent repeated computations inside Array.filter in React Renders
**Learning:** React component lists (like ContactsList and UnifiedInbox) may perform string operations or loops inside `Array.filter` during renders. `searchTerm.toLowerCase()` was previously being invoked 3 times per item in `ContactsList` on every re-render.
**Action:** When inspecting list filtering, look for invariant values computed inside the loop. Hoist invariant computations out of the loop and wrap the entire calculation in `useMemo` to protect against unrelated re-renders.
