## 2024-08-20 - Prevent unnecessary array filter recalculations on re-renders
**Learning:** Found multiple components (`ContactsList`, `KBPanel`) that filter arrays on every render based on search terms without memoization.
**Action:** Always wrap expensive list filtering logic in `useMemo` when rendering lists of items that can be searched or filtered to prevent recalculation when unrelated state changes. Ensure the dependency array includes both the source array and all filter criteria state variables.
