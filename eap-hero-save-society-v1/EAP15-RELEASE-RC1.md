# EAP 15 Sessions Release Candidate 1

This release candidate closes the five agreed workstreams:

1. Canonical, session-specific content for S1–S15 and B1–B5.
2. Source-specific four-choice quality with answer-position rotation and balanced option length.
3. Sheet/Cloud-authoritative runtime guard and localStorage diagnostics.
4. Automated browser release gate (`?eapqa=1` or `await EAP15ReleaseQA.run()`).
5. Complete Thai Teaching Pack for all 15 sessions.

## Release gate

Open the canonical player with `?eapqa=1`. The panel must report no errors before deployment. Warnings require review but do not necessarily block a classroom pilot.

## Manual end-to-end matrix

Test two identities: a new student with no matching Sheet rows and an existing student with verified progress. Run S1→B5, close/reopen the browser at each Boss boundary, replay every normal session at least three times, and confirm Best, Latest, attempt history, Exposure, and Boss Speaking review in the teacher dashboard.
