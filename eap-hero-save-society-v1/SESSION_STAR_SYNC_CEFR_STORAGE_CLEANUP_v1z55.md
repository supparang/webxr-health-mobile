# v1z55 Session Star Sync + CEFR Storage Cleanup

Fixes:
- S6 report has scores but stars/status do not update.
- CEFR label corrupted as CEFR Boss Gate 1.
- Storage quota warnings continue after compact save.

Rules:
- Session stars are based on Core + Support best scores.
- avg >=85 = 3 stars
- avg >=70 = 2 stars
- avg >=60 = 1 star
