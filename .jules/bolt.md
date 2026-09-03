## 2024-05-18 - Optimize Contacts List Filtering
**Learning:** `ContactsList` filtering in `src/features/crm/components/contacts-list.tsx` ran an expensive `toLowerCase()` on the search term inside the `.filter` loop and evaluated on every render.
**Action:** Always wrap heavy list filtering operations in `useMemo` and extract static or computationally expensive variables (like lowercase conversions) outside of the loop.
