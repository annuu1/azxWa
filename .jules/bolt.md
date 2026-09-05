## $(date +%Y-%m-%d) - O(N*M) Rendering Bottleneck in Lists
**Learning:** In src/features/crm/components/pipeline-board.tsx, using .filter() on a large dataset inside a .map() loop for rendering stages caused an O(N*M) complexity bottleneck.
**Action:** Replaced the .filter() with a single useMemo pass using a Map to group items, reducing complexity to O(N + M). This pattern is a highly effective, textbook performance optimization for Kanban/pipeline boards and similar UI components.
