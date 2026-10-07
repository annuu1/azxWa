# Bolt Journal
## 2025-01-20 - Memoization Strictness
**Learning:** Strict TS environments might disallow `typeof` inference if an array is readonly and you try to push to it, and lint configurations often forbid the non-null assertion operator `!`.
**Action:** When grouping into a Map, use an explicit type like `any[]` if `leads` is loosely typed, and prefer assigning the array to a variable to avoid `!` (e.g. `let group = map.get(id); if (!group) { group = []; map.set(id, group); } group.push(item);`). Also ensure Markdown files are never left empty to pass `markdownlint`.
