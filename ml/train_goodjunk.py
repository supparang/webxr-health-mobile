# === /webxr-health-mobile/ml/train_goodjunk.py ===
# GoodJunk ML Starter (baseline) — trains a simple model from exported CSV
# Input: data/goodjunk_sessions.csv (and optionally events)
# Output: artifacts/goodjunk_model.json (simple rule weights) + report.txt

import os, json
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
ART  = ROOT / "artifacts"
ART.mkdir(parents=True, exist_ok=True)

def main():
    sess_path = DATA / "goodjunk_sessions.csv"
    if not sess_path.exists():
        raise SystemExit(f"Missing {sess_path}. Export sessions tab from Google Sheet as CSV -> put here.")

    df = pd.read_csv(sess_path)

    # --- adapt to your column names (from your logger schema) ---
    # We try common names; adjust as needed.
    def pick_col(*names):
        for n in names:
            if n in df.columns:
                return n
        return None

    col_score = pick_col("scoreFinal", "score", "totalScore")
    col_miss  = pick_col("misses", "miss", "missTotal")
    col_acc   = pick_col("accuracyGoodPct", "accuracy_pct", "accPct")
    col_rt    = pick_col("medianRtGoodMs", "medianRtGoodMs")

    if not all([col_score, col_miss, col_acc, col_rt]):
        raise SystemExit(
            "Columns not found. Please map your sheet headers.\n"
            f"Have columns: {list(df.columns)[:30]} ..."
        )

    # Baseline: learn risk thresholds from quantiles
    q_acc_low = float(df[col_acc].quantile(0.25))
    q_miss_hi = float(df[col_miss].quantile(0.75))
    q_rt_hi   = float(df[col_rt].quantile(0.75))

    model = {
        "type": "quantile_heuristic_v1",
        "thresholds": {
            "acc_low": q_acc_low,
            "miss_high": q_miss_hi,
            "rt_high": q_rt_hi
        },
        "notes": "Prediction-only. Use in goodjunk-model.js -> makePredictorFromJson later."
    }

    out = ART / "goodjunk_model.json"
    out.write_text(json.dumps(model, ensure_ascii=False, indent=2), encoding="utf-8")

    (ART / "report.txt").write_text(
        f"Trained heuristic thresholds\n"
        f"acc_low (25%): {q_acc_low:.2f}\n"
        f"miss_high(75%): {q_miss_hi:.2f}\n"
        f"rt_high  (75%): {q_rt_hi:.2f}\n",
        encoding="utf-8"
    )

    print("OK ->", out)

if __name__ == "__main__":
    main()
