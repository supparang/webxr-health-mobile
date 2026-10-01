# ACTIVA-AI P4.1 — Ethics Submission Checklist (Pre-submission)

Status: NOT SUBMITTED. Owner: Human PI and authorized institutional officer. Date drafted: 2026-10-01. Recruitment setting P4.1.2: CRU lecturers and staff aged 18+; site permission PENDING.

## Official-form confirmation (first action)

The CRU Research and Development Institute article, published in **2021**, has an ethics submission workflow and preliminary document-check contact at `ethics.cru@chandra.ac.th`:
- https://teacher.chandra.ac.th/rdi/index.php/pr/in-pr/169-ethics
- Older process reference: https://teacher.chandra.ac.th/rdi/images/Ethics/Human/01human-ethics-dt/02human-manual-rch.pdf

These are historical references, **not proof that forms, copy count (historically 15), review categories, fees, portal or 2026 deadline are unchanged**. The PI must request the CURRENT application forms, required attachments, method of submission, meeting dates, exemption/expedited/full board eligibility and consent/e-consent requirements. The ethics office decides the review category. The external journal announcement https://li01.tci-thaijo.org/index.php/crujournal/announcement/view/2076 also indicates that manuscripts involving human research require appropriate research ethics approval; this is not a substitute for institutional instructions.

## Preparatory inventory and owners

| Gate | Attachment/reference | Owner | Current status |
| --- | --- | --- | --- |
| E01 Current CRU forms/process, category and calendar | Written confirmation from research ethics office | PI | PENDING |
| E02 Principal investigator / research team identity, role, affiliation, qualifications | Restricted personnel/CV documents (do not put PII in public repo) | PI | PENDING |
| E03 Project title, protocol and synopsis | `docs/phase4-ethics-application-draft-th.md` | PI | DRAFT |
| E04 Adult participant information and consent | `docs/phase4-participant-information-consent-th.md` | PI/ethics | DRAFT |
| E05 CRU site permission, independent lecturer/staff recruitment and non-research attendance alternative | `docs/phase4-cru-site-permission-draft-th.md`, `docs/phase4-cru-recruitment-plan.md`, signed institutional permission (restricted) | Authorized CRU site authority/PI | DRAFT; permission NOT OBTAINED |
| E06 Scientific protocol, operational SOP and Thai participant instruments | `docs/phase4-research-protocol.md`, `docs/phase4-field-pilot-sop.md`, `docs/phase4-instruments.md` | PI | DRAFT |
| E07 Ground Truth codebook, two distinct independent reviewers, adjudication process | `docs/ground-truth-codebook.md`, `docs/v1.1.0-phase3-external-blind-review.md` | PI | STRUCTURAL READY; human staffing PENDING |
| E08 Source-based size rationale and actual calculation for CRU staff (persons vs repeated attendance records) | `docs/phase4-cru-sample-planning-worksheet.md`, `ml/phase3-sample-plan.json`, `ml/plan_phase3_sample.py` and real result | PI/Statistician | PENDING — prevalence, model strength, activity types and clustered minima unavailable |
| E09 Data security, pseudonymization, controller, retention and withdrawal/reconciliation | Sections in protocol and consent; site-specific retention/access matrix | PI/Data steward | PENDING |
| E10 Funding/conflict-of-interest declaration and any training certificates | Current committee forms | PI/team | PENDING |
| E11 Review/sign-off of all versions and translation | Version-controlled final application pack | PI | PENDING |
| E12 Official submission/reference and later committee decision | Authorized institutional channel | PI/Office | NOT SUBMITTED |

## Content-sensitive questions requiring actual answers

1. Which authorized site(s) and adult recruitment population? Are any participants subordinate to a recruiter or investigator?
2. Can research consent be declined while normal operational attendance still proceeds; what is the exact non-research path?
3. What are the identity/permission boundaries for ADMIN, STAFF, research coordinator and blinded reviewers?
4. What will be the real study period, recruitment quota based on the calculated sample plan, number of activities and compensation (if any)?
5. Who is the data controller/custodian, where will the offline subject-code mapping be stored, what encryption/backups and access rules apply, and when is each data type destroyed?
6. What happens after withdrawal when operational immutable audit must be retained but previous research extracts/models are no longer eligible?
7. How will consent-version changes, protocol amendments and security/adverse incidents be handled before fieldwork?
8. Are shadow AI outputs allowed for research observation only, while all operational decisions remain human?

## Confirmed P4.1.2 population and site-specific stop checks

- **Population fixed for this submission draft:** CRU academic lecturers and professional/support staff aged at least 18, in prospectively approved university activities. Students and other external organizations are out of scope unless a new version/amendment is reviewed.
- **Site permission:** requester and approver to be determined via CRU Research and Development Institute; PI must obtain signed approval of actual faculties/offices/activities and neutral recruitment channel before recruiting.
- **Workplace power imbalance:** do not have direct supervisors, personnel evaluators or HR gather named research acceptance/refusal lists. Disclose PI dual role if also manager/Production ADMIN; protect consent/refusal status from employment use.
- **Non-research alternative:** an approved normal operational attendance option must be demonstrated for staff who do not consent; the Guest Pass itself requires its approved consent path and cannot be called a no-consent alternative without verification.
- **Sample plan:** keep `ml/phase3-sample-plan.json` PENDING; do not fill N, prevalence or model strength from QA_TEST or from a future held-out evaluation set. Review whether a single CRU population can provide sufficient distinct staff and unseen-person final-test cases.
- **CRU official guidance:** the RDI submission notice at https://teacher.chandra.ac.th/rdi/index.php/pr/in-pr/169-ethics and PDF https://teacher.chandra.ac.th/rdi/images/Ethics/Human/01human-ethics-dt/02human-manual-rch.pdf are historical guidance and not confirmation that the same forms/deadlines remain current in October 2026. Request an up-to-date packet from the secretariat before filing.

## Suggested pre-submission document order

Cover/submission form -> synopsis -> complete protocol -> recruitment text/site permission -> participant information sheet -> consent form -> instruments -> reviewer/codebook/SOP -> sample calculation -> data protection/withdrawal plan -> PI/researcher credentials/COI/funding -> appendices/software architecture.

## STOP

Do not collect EMPIRICAL human research data, recruit study participants, represent this draft as approval, create backdated empirical activities, convert QA_TEST to EMPIRICAL, or train an empirical model until the appropriate human authorization and prospective sample-plan gate are met. Existing synthetic/disposable CI remains allowed only for software verification and must never be reported as field findings.
