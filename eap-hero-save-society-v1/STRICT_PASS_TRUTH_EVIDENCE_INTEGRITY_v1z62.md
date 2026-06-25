# v1z62 Strict Pass Truth + Evidence Integrity

Critical fix:
A Session is NOT passed when only one required skill has a passing score.

Example:
Reading 90/60 + Speaking 0/60
= Session In Progress, not Passed
= avg 45
= 0 stars

Pass truth:
Core >= 60 AND Support >= 60
No old done/completed/cleared flag can override this rule.
