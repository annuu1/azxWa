## 2024-05-18 - Optimize redundant object iteration inside loops
**Learning:** Found an unnecessary string recalculation (`.toLowerCase()`) happening up to three times per contact per render in `ContactsList`. This type of overhead grows quickly with larger datasets.
**Action:** Always scan `.filter`, `.map`, and `.reduce` functions in React components to see if static variables or static computations can be extracted outside the loop iteration block, reducing the computational weight per render.
