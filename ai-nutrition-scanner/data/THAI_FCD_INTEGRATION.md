# Thai food composition data integration: provenance and release gate

Status: **SOURCE IDENTIFIED — NO DATA IMPORTED OR VERIFIED.**

## Primary reference
Institute of Nutrition, Mahidol University (INMU). *Thai Food Composition Database*, Online Version 3 (August 2025).

Official source: https://inmu.mahidol.ac.th/thaifcd/home

The official resource reports that online Version 3 integrates analysed and reviewed data, with reference to FAO/INFOODS checking guidelines. Consult current official terms before any redistribution or deployment:
- https://inmu.mahidol.ac.th/thaifcd/
- https://inmu.mahidol.ac.th/thaifcd/content/term-and-condition

The source permits access and use free of charge for noncommercial users with proper attribution. **Do not assume that copying an entire table into a public or commercial app is licensed.** Record the intended use and obtain written guidance/permission from INMU when distribution rights are uncertain. Educational and nonprofit purposes do not automatically make every deployment noncommercial.

## Scientific data linkage is NOT a direct dish-name lookup
The food recognition catalog is only eight high-level *dish labels*. Mixed meals (e.g., rice, protein, sauces, eggs) require:
1. Verified food code / exact reference name for the source entry;
2. Edible portion basis and units (per 100 g edible cooked portion, or other explicitly documented basis);
3. Recipe identity, region/brand, cooking yield and seasoning assumptions;
4. Composition of a dish split into ingredients when exact composite-food data are unavailable;
5. Documented missing values, especially added sugars and sodium; **missing must not be treated as zero**;
6. Version, source URL, permitted use, extraction/review date, reviewer identity and uncertainty/coverage notes.

## Proposed auditable row contract (do not invent values)
Required per-item fields when importing data:
- foodId: internal catalog identifier
- sourceSystem: THAI_FCD_INMU
- sourceVersion: 3-2025-08
- sourceFoodCode: verified identifier from original record
- sourceFoodName: exact name matched to the original record
- basis: clearly documented amount and edible-part state
- kcal, protein_g, carbohydrate_g, fat_g, sugars_g, sodium_mg: numbers **or null** if missing in source
- referenceUrl: direct official source or equivalent documented traceable citation
- rightsApproval: date, authorized scope and evidence
- reviewer1, reviewer2, reviewedAt: independent source-match and unit checks

Acceptance rules:
- No source code + exact mapping => **NO production nutrient value.**
- No documented legal rights => **NO public release of copied composition data.**
- Any missing nutrient => show "not available", not zero.
- Composites without a matching validated recipe => **NO false total**.
- Screenshot similarity / model self-confidence cannot establish weight or nutritional validity.
- User correction of weight alone does not solve food recipe uncertainty.

## Research evaluation design (to implement after data approval)
Independent ground truth: labeled photographs of Thai meals, recorded recipe, measured edible portion weights, reference nutrient values calculated from verified ingredient quantities or analysed samples.

Evidence to report by recipe category and device:
- Image recognition: top-1, top-3, unknown-food false-positive rate, confusion matrix.
- Portion: MAE (g), bias, and appropriate proportional errors where denominators are nonzero.
- Nutrients: MAE per nutrient, bias, dispersion and uncertainty intervals against credible reference.
- Human factors: usability, correction rate, time per meal, accessibility, and consent comprehension.
- Reproducibility: data version, model name/snapshot, prompt/schema hash and audit dates.

**Present release policy:** AI may provide a tentative food label. The system displays **no nutrient estimates** for real AI-mode scans until source-validated data and mapping are explicitly approved. The separate demo mode uses conspicuously labeled invented fixtures exclusively for software QA.
