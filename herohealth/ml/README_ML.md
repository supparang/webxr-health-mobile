# ML for GoodJunk (Prediction only)

## Goal (MVP)
Train a simple model to predict a near-future risk signal:
- `hazard_label` = 1 if `miss_total` increases within the next 4 seconds

This matches the in-game HUD:
- `hazardRisk` ~ probability of hazard_label=1

## 1) Export dataset

### Option A — From Browser (offline / API 403)
1. Import the collector:
   ```js
   import { createGoodJunkDatasetCollector, addHazardLabels, rowsToCSV, downloadText } from '../vr/goodjunk-model.js';
   ```
2. Create it in your run page:
   ```js
   const collector = createGoodJunkDatasetCollector({ windowSec:4, stepSec:1 });
   ```
3. Inside your game loop (where you already call AI?.onTick), also call:
   ```js
   collector.onTick(dt, {
     // feed the same state you already have in goodjunk.safe.js
     score, missTotal, missGoodExpired, missJunkHit,
     combo, comboMax: bestCombo, feverPct: fever, shield,
     shots, hits, accPct: accPct(), medianRtGoodMs: Math.round(median(rtList)),
     stormOn, bossActive, tLeft, diff, view
   });
   ```
4. Add an admin button (only when `?debug=1`) that downloads a CSV:
   ```js
   const rows = addHazardLabels(collector.getRows(), 4);
   const csv = rowsToCSV(rows);
   downloadText(`goodjunk_dataset_${Date.now()}.csv`, csv);
   ```

### Option B — From Google Sheets (when API works)
Export `events` / `sessions` as CSV, then transform into windowed rows.
(We can add a transformer script once your sheet schema is finalized.)

## 2) Train
From this folder:
```bash
pip install -U pandas scikit-learn joblib
python train_goodjunk.py --csv sample_dataset.csv
```

## 3) Use model in browser
This starter pack uses scikit-learn baseline. Common deployment options:
- Export to ONNX and run in browser (onnxruntime-web)
- Or implement a tiny logistic model in JS (weights + sigmoid)

Tell me which approach you want and I will generate the exact integration file.
