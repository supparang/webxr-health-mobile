# Thai Food Composition Database (Thai FCD) Integration Plan

## Purpose
`ai-nutrition-scanner` currently separates:
1. **Demo Mode (`ILLUSTRATIVE_FIXTURE_NOT_VALIDATED`)**: Approximate illustrative nutrient fixtures for software verification and nutrition-literacy UI demonstrations.
2. **AI Vision Mode (`AI_CLASSIFICATION_ONLY_NO_UNVERIFIED_NUTRIENTS`)**: Structured visual dish classification only — **never** attaches or exports unverified nutrient figures.

Before any public pilot, health intervention, or research outcome measurement displays nutrient values for AI-scanned meals, authoritative Thai food composition records must be sourced, reviewed, and legally integrated.

## Candidate Authoritative Source
- **Thai Food Composition Database (Thai FCD)** — Institute of Nutrition, Mahidol University (INMU), Online v3 (August 2025) and Bureau of Nutrition, Department of Health, Ministry of Public Health (Thailand).

## Integration Checklist (Required Before Enabling AI Nutrient Output)
1. **Rights & Attribution Verification**
   - Confirm licensing/redistribution terms with INMU / Department of Health for web/mobile research use.
   - Display required source citation, dataset version, and retrieval date in both UI and CSV export metadata.
2. **Canonical Dish & Recipe Mapping**
   - Map each `food_id` in `THAI_FOOD_CATALOG` to verified Thai FCD food codes (e.g., standard single-plate serving weight in grams, cooking oil assumption, soup broth inclusion/exclusion).
   - Document variance ranges (e.g., street-vendor sodium and oil variance) rather than presenting point estimates as exact laboratory measurements.
3. **Standard Household Units**
   - Align portion multipliers (`0.5×`, `1×`, `1.5×`, `2×`) with Thai household measures (ทัพพี, ช้อนกินข้าว, ชาม, แก้ว) reviewed by a registered dietitian / nutrition researcher.
4. **Data Provenance Schema**
   - Replace `PROVENANCE.ILLUSTRATIVE_DEMO` only for entries carrying `{ source: 'THAI_FCD_INMU_V3', foodCode, version, reviewedBy, reviewedAt }`.
   - Retain `AI_CLASSIFICATION_ONLY_NO_UNVERIFIED_NUTRIENTS` for `unknown` dishes or unmapped custom entries.
5. **Ethics, Privacy & Security Gate**
   - Complete IRB / ethics review and participant consent flow where applicable.
   - Confirm AI provider zero-data-retention / privacy terms and add rate limiting + authentication on `/api/analyze` before public deployment.
