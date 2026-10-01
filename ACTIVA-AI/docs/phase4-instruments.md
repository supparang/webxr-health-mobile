# ACTIVA-AI Phase 4 — Instruments and Data Collection Pack (DRAFT)

**Version:** ACTIVA-P4-INST-001 | **Status:** NOT FIELD-APPROVED
These are proposed instruments for institutional review; they contain no participant answers, simulated empirical responses or invented validation coefficients. Translate/adjust the participant-facing wording with approved local expertise, then freeze item IDs before field use. Do not store real names/employee numbers, credentials or raw tokens in GitHub.

## A. Participant information / consent content for ethics review (template only)

Study purpose: to evaluate reliability, usability and research methods of ACTIVA-AI's participation-evidence process, including optional accountless Guest Pass. Participation in the **research** is voluntary and separate from the operational activity. Research refusal or withdrawal does not affect employment, grades, activity certification or services. Describe precisely what the operational application retains, what the research team receives in de-identified form, expected duration, foreseeable privacy and QR/availability risks, retention, access, withdrawal limits (including already published aggregate results), independent contact and institutional complaint channel. Specify whether model training, future reuse or data sharing will occur. Explain that a trained model, if later evaluated, only proposes review priority; humans make final decisions. Offer an equivalent non-research attendance path approved by site administrators.

Required fields to be completed by PI/ethics office BEFORE use: study title; investigator and independent contact; site; inclusion/exclusion; actual approved text and language; consent version; ethics decision reference and effective/expiry dates if applicable; risk/benefit description; retention/deletion rule; code-to-identity mapping custodian; withdrawal mechanism; access-control plan. Do not treat this template as issued ethics permission.

## B. Feasibility event CRF (one case per consenting participant-event)

Capture aggregate/pseudonymous identifiers only: `participant_hash` (analysis grouping), `event_id`, approved protocol/consent version, `consent_at`, `checkin_at`, `checkout_at`, `identity_witness_status`, `qr_validation_status`, `withdrawal_or_revocation`, `source_system_version`, `missing_data_reason`, `incident_code`. Retain all timestamps in UTC; specify planned clock drift tolerance. Never include a `SUBJ-...` plaintext code, raw Guest Pass, QR signature, employee ID, direct contact or full staff witness identity in exported research tables.

Report flow denominators separately: invited, consented, enrolled, attempted check-in, completed check-in, human-witnessed, attempted checkout, completed checkout, eligible for research, withdrawn. Operational records and research inclusion counts are NOT interchangeable. `QA_TEST` must contribute 0 to empirical denominators.

## C. Participant usability questionnaire (CUSTOM, not a validated standardized scale)

Response: 1 = strongly disagree / ไม่เห็นด้วยอย่างยิ่ง; 2 = disagree; 3 = neutral; 4 = agree; 5 = strongly agree / เห็นด้วยอย่างยิ่ง; NA = not experienced. Store `item_id`, response and participant pseudonym only. Pilot face/content validity before using as a reported scale; report item-level distribution first. Do not calculate overall construct scores unless a justified and preregistered measurement model supports them.

| ID | Construct | Thai participant-facing item |
| --- | --- | --- |
| U01 | Clarity | ฉันเข้าใจขั้นตอนการเข้าร่วมกิจกรรมในระบบได้ชัดเจน |
| U02 | Navigation | ฉันค้นหาปุ่มหรือหน้าที่ต้องใช้งานได้ง่าย |
| U03 | Consent | ข้อความขอความยินยอมอธิบายการใช้ข้อมูลได้เข้าใจง่าย |
| U04 | Accessibility | ฉันสามารถทำตามขั้นตอนบนอุปกรณ์ที่ใช้ได้สะดวก |
| U05 | QR check-in | ฉันเข้าใจว่าต้องใช้รหัส QR สำหรับ Check-in อย่างไร |
| U06 | QR checkout | ฉันเข้าใจว่าต้องใช้รหัส QR สำหรับ Check-out อย่างไร |
| U07 | Feedback | ระบบแจ้งผลสำเร็จหรือข้อผิดพลาดของแต่ละขั้นตอนได้ชัดเจน |
| U08 | Recovery | เมื่อพบปัญหา ฉันทราบว่าควรทำอย่างไรต่อ |
| U09 | Privacy | ฉันเข้าใจว่าข้อมูลใดถูกบันทึกและใครสามารถเข้าถึงได้ |
| U10 | Overall experience | โดยรวม ขั้นตอนเข้าร่วมกิจกรรมผ่านระบบใช้งานได้สะดวก |

For respondents with no QR or Guest feature exposure, use NA and report its denominator. Optional three separate open questions (no names in free text): what worked; what was difficult; what should change. Redact incidental identifiers from responses.

## D. Reviewer Ground Truth assessment sheet (independent A and B)

One versioned form per attendance ID; reviewer is assigned a study-side pseudonymous reviewer code and receives the same frozen, AI-blinded evidence package. No predicted label, risk probability or previous reviewer responses in their view.

Fields: case ref, reviewer A/B, codebook version, evidence availability checklist (QR, consent where guest, identity, timestamp, duration, checkout, staff evidence, signature where policy requires), binary `final_target` as PROPOSED `REVIEW_REQUIRED` or `NO_REVIEW_REQUIRED`, multi-select reason codes from `docs/ground-truth-codebook.md` (`MISSING_QR`, `MISSING_IDENTITY`, `MISSING_CHECKOUT`, `MISSING_STAFF_VERIFICATION`, `SHORT_DURATION`, `DUPLICATE_SCAN`, `TEMPORAL_CONFLICT`, `STAFF_WITHOUT_CHECKIN`, `OTHER`), short source-based rationale, signed independent attestation, completed timestamp. Unknown/insufficient evidence should be handled through a protocol-defined review/hold path, **not** forced into an invented target. Resolve disagreement via a separately documented adjudicator, and lock only after criteria are met.

## E. Operator / independent observer sheet

Record event ref, actor role (not personal name), UTC start/end, device and supported camera/QR method, outcomes at consent, check-in, check-out and identity witness, deviations and incident linkage, outcome `SUCCESS/FAIL/NOT_OBSERVED`. Observe mobile token disclosure remaining open during countdown and closing only on genuine QR rotation. Do not photograph token fragments or unredacted participant details.

## F. Shadow-pilot observation sheet — only after human model approval

Record pseudonymous case ref, model/manifest version, threshold version, whether prediction was available **before** final human decision, model recommendation, explanation version, human reviewer action and decision, review time, override/disagreement and reason code. Do not provide AI recommendations to the independent Ground Truth reviewers. Keep AI prediction and human final decision in evaluation tables only; never feed them into predictors.

## Instrument verification gate

Before real collection, retain expert relevance/clarity comments and revision log, comprehensibility pretest feedback, approved translations, protocol version, consent version and any required ethics decision. For IOC/content validity, pre-specify the expert count, relevance criterion and resolution method; report only actually collected ratings. Report survey missingness, descriptive item results and uncertainty without inventing reliability coefficients.
