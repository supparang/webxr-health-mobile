# v1z68 — Session Path Self-Practice UI Fix

## Screenshot issues fixed
1. Simple Mode previously showed only the Core card inside a 4-column grid. This caused a large empty dark area.
2. Support Mission was unnecessarily locked even though the official course path requires Core + Support evidence.
3. Four Skills Hub and Debug buttons remained visible in the Student Session Path.
4. SPA navigation preserved the previous scroll position, so a new page could open in the middle of its content.

## New Session Path
- Two equal-width cards: Step 1 Core and Step 2 Support.
- Both are available immediately as self-practice.
- Core is recommended first; Support is not a progress gate.
- Student Footer: Back to Map + My Learning Report only.
- Four Skills Hub/Debug remain outside Student Flow.
- Navigation resets to the top of the new screen.
- Long generic Session Quality cards are removed from mission cards; source-specific detail appears only after starting the task.
