## 2024-03-24 - Grouping Leads by Stage with O(1) Map Lookups
**Learning:** In Kanban-style or pipeline boards (like `src/features/crm/components/pipeline-board.tsx`), repeatedly filtering arrays on every render for multiple stages can lead to O(N*M) rendering bottlenecks.
**Action:** Replace `array.filter(l => l.stageId === stageId)` with a `useMemo` grouped `Map` lookup keyed by `stageId` to change this into a single O(N) pass, maintaining an O(1) lookup on render.
## 2024-03-24 - Missing Test Script breaks GitHub Actions Pipeline
**Learning:** The project's package.json is missing a `"test"` script, causing GitHub Actions executing `npm test` to fail.
**Action:** When creating CI workflows or fixing failed tests related to standard setup commands (like `npm test`), replace it with `npm run test --if-present` to bypass the issue in repositories without tests while still running them if they do exist.
