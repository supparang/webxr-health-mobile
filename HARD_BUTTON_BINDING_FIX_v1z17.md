# HARD_BUTTON_BINDING_FIX_v1z17

## Fixed
Session Path buttons not opening missions.

## Method
- Button has data-skill and data-session
- Inline onclick calls openSkillMissionFromButton(this)
- Document-level capture event delegation also handles clicks
- Public API exposes openSkillMissionFromButton and bindHardButtonDelegation
- Emergency globals are available for console testing
