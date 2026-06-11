# ADAPTIVE_AI_LIMIT_RUNTIME_FIX_v1z20

## Bug
CEFR support showed 3/3 Easy A2, but AI Mentor box still showed 0/2 left and limit reached.

## Fix
Runtime AI limit now uses adaptiveAIHelpLimit(skill) everywhere:
- canUseAI
- renderAIHelpBox
- useAIHelp
- aiHelpButtonLabel
