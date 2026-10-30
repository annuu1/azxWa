## 2024-05-18 - Multiple `.filter` Iterations for Stat Calculation
**Learning:** Found O(N*M) performance bottlenecks where components iterated over the same array multiple times using inline `.filter` to calculate aggregate statistics (`totalPending`, `totalCompleted`) in render blocks.
**Action:** Instead of calling `campaigns.filter(...).length` repeatedly, reduce to a single O(N) traversal block wrapped in a `useMemo` block that calculates all required metrics inside the memo.
