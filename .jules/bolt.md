## $(date +%Y-%m-%d) - Optimize Pipeline Board Leads Rendering
**Learning:** React components iterating over arrays multiple times per render (e.g., filtering `leads` by stage for every stage column) can create O(S*L) bottlenecks.
**Action:** Always prefer `useMemo` with a Map to group collections by foreign keys when they are rendered across multiple categories/columns to bring complexity down to O(S+L).
