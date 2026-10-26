# CSAI2601 Receiver — Full Reflection Preservation STAGING QA

**26 Oct 2026 — DRAFT only; do not deploy to production or touch student Sheet.**

## Verified defect

The previous receiver stored only the first 8 of payload.artifactFields
in both rawJson and the standalone artifactFields cell. The canonical
Studio form places explicit Weekly Reflection as field 9. Previously the
independently authored Reflection field could therefore be lost.

The Receiver also generated top-level reflection from problemSeen,
uxReason and fixAndTest. That text is not proof a student wrote a separate
Reflection.

## Safe patch scope

- Preserve complete valid artifactFields arrays (max 25 fields), retaining
  ninth Reflection field in rawJson and artifactFields; no change to
  previously stored rows.
- Never synthesize a new top-level Reflection. Preserve legacy
  top-level-only text but tag new rawJson.reflectionSource as
  top_level_unverified. Tag explicit_artifact_field where confirmed.
- Do not silently truncate JSON. Reject oversized events instead.
- Preserve original mission scores, event IDs, attempt deduplication,
  course/Section identity, Student Receiver configuration and teacher reviews.
- Beware: the current client uses no-cors POST, so an application-level
  error can be invisible to the sender. Validate actual Sheet writes.

## Staging steps

1. Run the synthetic local Node QA:
   node test_uxq_receiver_reflection_full_fields_staging.js
2. Create a NEW spreadsheet copy for QA, not the production Sheet.
3. Create a separate Apps Script project connected to this QA-only copy.
   Deploy a QA Web App; do not edit the production /exec deployment.
4. Point a student-page QA copy at the QA receiver endpoint only.
   Use a synthetic QA learner ID and Section isolated from actual learners.
5. Submit all 19 canonical W/B Studio cases and confirm in the QA Sheet:
   the explicit Reflection survives the ninth field in BOTH rawJson and
   artifactFields; course/Section/learner/event IDs remain intact.
6. Resend the same eventId and confirm just one saved row. Test legitimate
   9-field long text, oversized error, offline queue/retry and mobile.
7. Try old W7 5-field event and legacy top-level-only Reflection; keep
   Studio evidence but do not declare student-authored Reflection or 3/3.
8. Inspect real deployment routes and confirmation paths before any
   production rollout. PR #180 (legacy student sender) and PR #170
   (student live 3/3 unlock) MUST remain draft/unmerged.

## Student data policy

No production Sheets are accessed, written, erased or backfilled. The
historic 18/19 Mission, 19/19 Studio, 0/19 explicit Reflection pattern
is consistent with ninth-field truncation, but historic authorship cannot
be reconstructed from data that was never saved. Do not force a full-class
resubmission or silently credit synthesized Reflection.

**Release gate:** Keep this PR DRAFT until staging Apps Script + copied
Google Sheet E2E is verified by the owner. GitHub unit tests are not
equivalent to a live deployment test.
