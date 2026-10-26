# CSAI2601 UX Quest — Studio Reflection QA across 19 W/B nodes

**Date:** 26 October 2026. **Status: STAGING PATCH ONLY. DO NOT DEPLOY TO STUDENTS YET.**

## Root cause of the real W7 screenshot

A historical learner W7 submission lists `fiveScreens`, `gridSpacing`, `visualHierarchy`, `ctaPlacement`, and `mobileConsideration`; the old sender `js/uxq-w7-production-hardening-v2.js` constructed top-level `reflection` with `Object.values(data).join(' | ')`, without a separate Reflection field. That is not an independently authored Weekly Reflection. The student may have satisfied the W7 interface they were given; the saved five fields cannot prove what they would have written as a separate Reflection.

The other historic sender, `js/uxq-production-learning-authority-v1.js` (W1–W15 and B1–B4 excluding W7), similarly constructed `reflection` by joining the Studio field values. That explains why such legacy records may show Studio submitted yet Reflection unverified.

**Do not automatically assign 3/3 or require all historical learners to resubmit.** Their old attempt/Studio records must remain intact; the old synthetic text cannot be used to prove Reflection authorship.

## Canonical modern form contract

The current `csai2601-canonical-node-clean-v1.html` loads:

- `uxq-studio-practice-canonical-all-v2.js`
- **then** `uxq-course-alignment-bridge-v1.js` (the final schema owner)
- `uxq-studio-practice-ui-v1.js` and `uxq-studio-practice-submit-v1.js`

The final schema owner generates one **explicit nonblank, required** `reflection` field at the end of the Studio form **for each of the 19 W/B nodes**, including W7 (ninth field in the four-task-group canonical setup). The structured sender collects all `[data-studio-key]` inputs, with `reflection` coming from the learner's actual field, not from the five W7 Studio areas.

This is a **source-code contract verification**, not proof that every student currently uses this page or that the deployed Google Apps Script Receiver records all nine fields. Existing Receiver versions might truncate `artifactFields` at eight; validate this separately in a staging copy before changing live progress rules.

## This staged legacy-path patch

- `js/uxq-w7-production-hardening-v2.js`: adds a dedicated Weekly Reflection textarea for the old five-field form; validates at least 40 characters, stores it as `artifactFields[{key:'reflection'}]`, uses that exact text for top-level Reflection, and stops constructing it from other Studio fields.
- `js/uxq-production-learning-authority-v1.js`: applies the same independent Reflection capture to the other old W/B paths.
- Both legacy scripts ignore the modern structured `artifact[data-studio-practice-v1]` and its own reflection and submit controls.
- Neither script edits, deletes or reclassifies existing rows. Student identity, old scores, game progress, Studio submissions and teacher reviews are unchanged.

## QA and release gates (must pass before any main merge)

1. Run `node test_uxq_w7_reflection_legacy_staging.js` (synthetic records only).
2. In a staging browser open an old W7 five-field form. Confirm separate Reflection is visible, submission fails when blank, and a new, explicitly authored Reflection results in exactly six `artifactFields` (the original five plus Reflection).
3. Check one other historical W/B path using the generic producer; it must also require an independent Reflection. Check both variants do not intercept current canonical form submission.
4. Validate all 19 canonical Studio form schemas and real end-to-end `artifact_submitted` writes against a **staging Google Apps Script receiver connected to a COPY** of the production Sheet. Verify ninth Reflection survives `rawJson` and/or `artifactFields`, and preserves studentId, Section and course.
5. Test eventId deduplication, offline queue resend, same-device resume, mobile, and legacy older rows. Verify no duplicate writes.
6. If production students exclusively use the modern canonical page, the legacy senders may not need production deployment at all. Investigate the exact live page/script URL before deciding.
7. Coordinate with the independent draft PR #170 for 3/3 unlock logic. **Do not merge #170 or deploy a new student lock before the backend and legacy submissions pass staging.**

## Preservation of existing students

Never overwrite or backfill missing historical Reflection. A five-field W7 Studio record remains evidence that Studio was submitted, not proof Reflection was written. If a previous UI failed to collect a separate Reflection, review old coursework sources fairly before assigning new requirements. This proposal is intended to secure **future** submissions without destructive migration.
