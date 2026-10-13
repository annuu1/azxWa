
## 2024-05-18 - Memoize inline array filtering inside render loops
**Learning:** The application codebase features instances of rendering logic that iterates through arrays with O(N*M) complexity (e.g., repeatedly calling `.filter()` on an array of deals within a `.map()` over stages). In large data states this creates a heavy computational overhead during component renders.
**Action:** When inspecting `.map()` loops inside React render components, look for inline `.find()` or `.filter()` calls iterating over shared data collections. Bolt should safely hoist these out into O(1) Map lookups combined with `useMemo`. Ensure type safety by using `typeof collection`.
