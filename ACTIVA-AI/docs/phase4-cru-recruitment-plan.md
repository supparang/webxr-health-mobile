# ACTIVA-AI P4.1.2 — CRU Personnel Recruitment & Non-Coercion Plan (DRAFT)

**Version:** ACTIVA-P4-CRU-REC-v0.1  
**Research site:** Chandrakasem Rajabhat University (CRU), Bangkok, Thailand — institutional permission NOT YET OBTAINED.  
**Population:** adult lecturers and university staff, age 18 or older; students and external guests are not in this proposed recruitment population.  
**Protocol linkage:** ACTIVA-P3-RP-001; `phase4-research-protocol.md`; `phase4-ethics-application-draft-th.md`.  
**Ethics status:** NOT SUBMITTED; no prospective human recruitment or empirical collection is authorized by this document.

## 1. Eligibility framework for PI and committee review

**Inclusion (proposed):** CRU academic lecturers or professional/support staff aged at least 18; eligible for an approved CRU activity within the approved study window; capable of understanding the approved information and providing voluntary consent; willing to use an approved participant route (Guest Pass or another route covered by the protocol). A private registry may track eligibility without transferring identity data into the research dataset.

**Exclusion (proposed):** younger than 18; outside CRU's lecturer/staff population; not participating in the approved activity; unable to give free informed consent under the proposed adult-consent process; active withdrawal/revocation of research permission. Do not categorically exclude a person merely because their phone lacks camera or BarcodeDetector: provide the documented signed-QR manual-input/accessibility route where appropriate, or document a justified operational/ethics-approved alternative.

**Unit of recruitment:** a unique consenting person; **unit of prediction:** a unique eligible attendance record. Repeated attendance by one person cannot be counted as independent unique participants. `participant_hash` is grouping only, never an ML predictor; `event_id` supports event sensitivity checks.

## 2. Independence and avoidance of undue influence

- An independent research coordinator, rather than the direct supervisor, personnel evaluator, activity-certification decision maker or immediate administrator, should send the research invitation and conduct the consent conversation.
- Invitation should go through a permitted, neutral university announcement or designated coordinator, with one standard script, clear opt-out and reasonable decision time. A unit head may distribute a general notice but must not collect named opt-in/opt-out lists for personnel evaluation.
- Separate the duty to record required **operational attendance** from voluntary participation in **research**. Before filing, obtain a concrete, authorized non-research attendance route (e.g. approved existing account-based attendance or permitted administrative/manual process); do not promise an unimplemented route.
- Non-participation, skipped questionnaire items or withdrawal must not affect employment, contract renewal, promotion, performance assessment, activity certification, remuneration, teaching load, training access or other institutional benefits.
- Where an investigator is also a CRU supervisor, line manager or ACTIVA-AI Production ADMIN, disclose the dual role to the ethics committee, document role-separated recruitment, and limit visibility/secondary use of consent status. Do not falsely claim that authorized operational ADMIN cannot ever see the underlying consent marker.
- Participation and AI outputs must never be sent to HR/management for individual scoring, sanction or administrative personnel decisions; human operational attendance verification is independent of research participation.

## 3. Recruitment workflow (only AFTER the appropriate approvals)

1. PI documents CRU site authorization and the applicable ethics approval/exemption determination; freezes protocol, eligibility, approved consent version and actual study window.
2. Research coordinator verifies the activity is authorized and invites eligible adults through the approved neutral channel. No recruiter must create an `EMPIRICAL` activity before approval.
3. Provide information sheet and opportunity to ask questions privately; give suitable time to decide; confirm separate non-research operational attendance route.
4. Those voluntarily opting in receive the approved consent process and an offline pseudonymous study code. Separate custodian holds identity mapping securely. Do not put names/employee IDs/direct contact/actual code in GitHub or data extracts.
5. ADMIN prospectively establishes new `EMPIRICAL` activity and issues one-time Guest Pass only to those consented under the approved scope. Guest accepts the exact version before check-in. Existing `QA_TEST` cases remain permanently excluded from empirical research.
6. Observe actual Check-in, in-person STAFF/ADMIN identity witness and Check-out. Record errors and refusals in aggregate without retroactive reconstruction.
7. Two different real blind reviewers separately label eligible Ground Truth; disagreements undergo documented adjudication before LOCK.
8. Refresh eligibility at every research export and withdrawal event; preserve only permitted aggregate recruitment flow and controlled deviation log.

## 4. Invitation message — draft for committee review

**เรื่อง: ขอเชิญพิจารณาเข้าร่วมโครงการวิจัย ACTIVA-AI (สำหรับอาจารย์และบุคลากรที่มีอายุ 18 ปีขึ้นไป)**

มหาวิทยาลัยราชภัฏจันทรเกษมมีการเตรียมศึกษาการใช้ระบบ ACTIVA-AI สำหรับบันทึกและตรวจสอบหลักฐานการเข้าร่วมกิจกรรม โดยอาสาสมัครที่เข้าเกณฑ์สามารถเลือกเข้าร่วม *งานวิจัย* ด้วยความสมัครใจ ภายใต้เอกสารชี้แจงและแบบยินยอมฉบับที่ผ่านการพิจารณาที่เหมาะสม การไม่เข้าร่วมวิจัย การข้ามข้อคำถาม หรือการถอนความยินยอมจะไม่กระทบการเข้าร่วมกิจกรรมตามภารกิจปกติ การประเมินบุคลากรหรือสิทธิประโยชน์อื่น

หากสนใจ กรุณาติดต่อผู้ประสานงานวิจัยอิสระ [ช่องทางที่ได้รับอนุญาต] เพื่อรับข้อมูลครบถ้วนและซักถามก่อนตัดสินใจ ทั้งนี้จะเริ่มรับสมัครได้หลังได้รับการอนุญาตจากหน่วยงาน/คณะกรรมการที่เกี่ยวข้องแล้วเท่านั้น

**DO NOT SEND THIS INVITATION BEFORE RESEARCH AUTHORIZATION.**

## 5. Recruitment flow report (fill with OBSERVED aggregate counts only)

| Metric | Value | Denominator/source |
| --- | --- | --- |
| Adults eligible at approved activities | PENDING | pre-specified eligibility log |
| Persons invited | PENDING | neutral coordinator log |
| Persons expressing interest | PENDING | research coordinator |
| Persons voluntarily consented | PENDING | controlled consent registry |
| Research refusals / nonresponse | PENDING | aggregate only, no named list to HR |
| Unique consenting participants attending | PENDING | pseudonymous grouping |
| Eligible attendance records | PENDING | `EMPIRICAL_ATTENDANCE_FILTER` |
| Withdrawn / revoked / voided | PENDING | eligibility reconciliation |
| Consenting persons included in LOCKED analysis | PENDING | governed research dataset |

No PI, University or committee authorization is inferred from the proposed site/population alone.
