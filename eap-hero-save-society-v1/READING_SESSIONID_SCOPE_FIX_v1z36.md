# READING_SESSIONID_SCOPE_FIX_v1z36

Fixes:
- Mission could not open. Error: sessionId is not defined

Cause:
- v1z35 injected readingQuestionSetForSession(sessionId) into a function where sessionId was not in scope.
