# ACTIVA-AI P4.1.2 — CRU Sample-Size Planning Worksheet

**Version:** ACTIVA-P4-CRU-SAMPLE-v0.1  
**Protocol:** ACTIVA-P3-RP-001; **existing plan:** `ml/phase3-sample-plan.json` (`PENDING`)  
**Recruitment population:** CRU lecturers and staff aged 18+; unit of recruitment = unique participant; unit of primary prediction = eligible attendance record.  
**Status:** PLANNING ONLY; does not supply empirical numbers, override study governance or approve training.

## A. Do NOT invent the missing assumptions

The existing frozen modelling contract is: outcome `REVIEW_REQUIRED` (positive) versus `NO_REVIEW_REQUIRED`; 12 numeric/binary evidence features and `activity_type` with K preregistered levels. Candidate predictor parameter count is `12 + (K - 1)`, assuming K ≥ 2 and one category reference. The existing design specifies target shrinkage 0.90 and 20% participant-separated prospective final-test holdout. Candidate models: Logistic Regression, Random Forest, Gradient Boosting.

| Required plan field | Current value | Source/action needed before filling |
| --- | --- | --- |
| `anticipatedReviewRequiredPrevalence` | null | Cite appropriate pre-final-decision Ground Truth in a comparable development-only cohort, or obtain approval for a feasibility pilot and subsequently amend/finalize assumptions prospectively. QA_TEST labels and final-test outcomes are never prevalence sources. |
| `prevalenceSource` | null | Provide study/document DOI/URL or authorized aggregate planning snapshot reference, date and target-definition comparability. |
| `anticipatedActivityTypeLevels` | null | Obtain prospective CRU activity-category plan; define categories before viewing final test; handle rare levels according to a frozen preprocessing rule. |
| `candidatePredictorParameters` | null | Calculate 12 + K − 1 after categories fixed; count all category dummy parameters, not just number of raw features. |
| `anticipatedModelStrength.metric` | null | Select one recognized `cstatistic`, `csrsquared` or `nagrsquared` with defensible prior source. |
| `anticipatedModelStrength.value/source` | null | Source a relevant published comparable outcome or independent development-only data; sensitivity scenarios may be explored but must not be presented as observed findings. |
| `minimums.records` | null | Riley/pmsampsize result inflated so development portion meets its minimum after prospective 20% holdout. |
| `minimums.uniqueParticipants` | null | Justify adequate distinct lecturers/staff for no participant overlap; repeated activity scans cannot inflate independent participant N. |
| `minimums.uniqueEvents` | null | Justify diversity across approved CRU activities and planned event-group sensitivity analysis. |
| `minimums.reviewRequired / noReviewRequired` | null | Derive from source-backed prevalence, sample requirements and adequate numbers in both groups. |
| `finalTestMinimums` | null | Prespecify prospective held-out records and both class minima before inspecting final-test outcomes. |
| `planningSnapshot.cutoffUtc/snapshotSha256` | null | Freeze approved development-only aggregate snapshot and cutoff; all participants already seen by cutoff remain development-only, even for later records. |
| `status / approvedAt / approvedBy` | `PENDING / null / null` | Only authorized human statistician/PI approves after sources and review. |

## B. Required population and sampling-frame decisions

1. Site authority validates whether recruitment spans the entire CRU or selected faculties/offices and which kinds of CRU-organized activities are eligible; capture the adult lecturer/staff invitation frame as an access-controlled registry, not a public personnel roster.
2. Define recruitment method, nonresponse assumptions and an independent coordinator; prevent direct managers/HR decision makers from seeing named opt-in lists for performance purposes.
3. Count both (a) eligible attendance **records** and (b) unique consenting **persons** across events. More repeated scans from one person increase records but do not add independent participants for primary grouped validation.
4. Assess feasibility of an unseen-person 20% final-test cohort in a bounded single-university staff population. If scientific minima exceed accessible unique staff/events, do **not** shrink minimums post hoc: prospectively revise the model complexity, study objectives, period or permitted sites with PI/statistician and ethics amendment. P4.1.2 currently fixes CRU only; any expansion requires a documented protocol decision.
5. Screen sample-size impacts from withdrawals, ineligible events, incomplete checkouts and missing paired ground truth. Any recruitment inflation factor must have a documented basis; do not replace approved statistical minimums with arbitrary round numbers.

## C. Planning calculation route (once sources exist)

From ACTIVA-AI directory:

```bash
python ml/plan_phase3_sample.py \
  --plan ml/phase3-sample-plan.json \
  --output ml/phase3-sample-plan-result.json
```

The existing script applies Riley/pmsampsize binary prediction-model criteria. For the protocol's 20% internal holdout:

`N_total = ceil(N_Riley_development / 0.8)`.

This is internal held-out test inflation, **not** a validated external-validation sample-size calculation. If anticipated C-statistic ≥ 0.80, the existing stress-test flag must be satisfied before formal approval. `pmsampsize` does not determine CRU unique-participant/event minima automatically; a justified clustered design is required separately.

Then obtain development-only aggregate planning counts (with authorization, after any permitted collection):

`GET /api/ml/planning-summary?lockedBefore=<UTC-cutoff>`

Freeze snapshot SHA-256/cutoff. Never derive assumptions from the final-test labels. An ethics-approved internal pilot that is used to plan sample size must be permanently development-only; if approved pilot evidence is insufficient to support the model objective, the scientific study remains HOLD rather than forcing an AI efficacy conclusion.

## D. Ethics application wording pending calculation

“จำนวนตัวอย่างสำหรับการประเมินความเป็นไปได้และการพัฒนาแบบจำลองจะกำหนดล่วงหน้าจากสมมติฐานที่มีเอกสารอ้างอิง โดยใช้เกณฑ์ของ Riley และคณะผ่าน pmsampsize สำหรับผลลัพธ์ทวิภาค REVIEW_REQUIRED/NO_REVIEW_REQUIRED พร้อมพิจารณาข้อมูลซ้ำภายในบุคคล/กิจกรรม และสำรองชุดทดสอบจากบุคคลใหม่ตามแผนการวิจัย ผู้วิจัยจะแนบผลคำนวณ จำนวนผู้เข้าร่วมที่ไม่ซ้ำ จำนวนกิจกรรม และการเผื่อข้อมูลสูญหายก่อนยื่นโครงร่างฉบับสมบูรณ์ หากไม่มีสมมติฐานที่มีหลักฐานเพียงพอ ผู้วิจัยจะขอพิจารณาเฉพาะระยะศึกษานำร่องเพื่อประเมินความเป็นไปได้และข้อมูลประมาณการก่อน พร้อมยื่นแก้ไขเพิ่มเติมโครงร่างก่อนเข้าสู่การประเมินแบบจำลองหลัก”

This text is a **draft option**; whether a staged feasibility-first submission is appropriate must be confirmed with CRU ethics office/statistician. Never mark `APPROVED` or provide a nominal `N` until the source-backed calculation and human sign-off exist.
