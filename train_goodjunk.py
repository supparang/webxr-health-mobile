# === /train_goodjunk.py ===
# Train GoodJunk Risk Model -> export /herohealth/vr/goodjunk_weights.json
# FULL v20260302-TRAIN-GOODJUNK
#
# Usage:
#   python train_goodjunk.py \
#     --csv ./data/goodjunk_events.csv \
#     --out ./herohealth/vr/goodjunk_weights.json
#
# Label options (default):
#   label = 1 if (miss_next_3s > 0) OR (hitJunk_next_3s > 0) else 0
#
# Requires: pandas, numpy, scikit-learn

import argparse
import json
import numpy as np
import pandas as pd
from datetime import datetime, timezone

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, accuracy_score


FEATURES = [
    "miss",
    "hitJunk",
    "accPct",
    "medianRtGoodMs",
    "combo",
    "feverPct",
    "timeLeftSec",
    "bossOn",
]

def safe_num(s, default=0.0):
    try:
        v = float(s)
        if np.isfinite(v):
            return v
    except Exception:
        pass
    return float(default)

def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="CSV exported from Google Sheet (events-level or ticks-level)")
    ap.add_argument("--out", required=True, help="Output JSON path (goodjunk_weights.json)")
    ap.add_argument("--test_size", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--label_window_sec", type=float, default=3.0)
    return ap.parse_args()

def build_dataset(df: pd.DataFrame, label_window_sec: float):
    """
    Expect columns at least:
      - ts_ms (or tsMs or timestamp ms)
      - miss, hitJunk, accPct, medianRtGoodMs, combo, feverPct, timeLeftSec, bossOn
    If your sheet uses other names, map them before calling.
    """

    # ---- normalize timestamp col ----
    ts_col = None
    for c in ["ts_ms", "tsMs", "timestamp_ms", "timestampMs", "timeMs"]:
        if c in df.columns:
            ts_col = c
            break
    if ts_col is None:
        raise ValueError("Missing timestamp column (ts_ms / tsMs / timestamp_ms etc.)")

    df = df.copy()
    df["ts_ms"] = pd.to_numeric(df[ts_col], errors="coerce").fillna(method="ffill").fillna(0).astype(np.int64)

    # ---- ensure feature cols exist ----
    for f in FEATURES:
        if f not in df.columns:
            df[f] = 0

    # ---- numeric cleanup ----
    for f in FEATURES:
        if f == "bossOn":
            df[f] = df[f].apply(lambda x: 1 if str(x).strip().lower() in ["1","true","yes","on"] else (1 if safe_num(x,0) > 0 else 0))
        else:
            df[f] = pd.to_numeric(df[f], errors="coerce").fillna(0.0)

    # ---- label by future window (3s default) ----
    # We assume df is time-ordered (if not, sort)
    df = df.sort_values("ts_ms").reset_index(drop=True)

    # create future miss/hitJunk indicator within window
    window_ms = int(label_window_sec * 1000)
    y = np.zeros(len(df), dtype=np.int64)

    # two-pointer sweep
    j = 0
    future_bad = 0
    # We'll compute for each i: whether any miss/hitJunk occurs in (ts_i, ts_i+window]
    # Approach: for each i, move j to include future events, track if any bad exists in range.
    # Simpler: brute force with rolling not perfect; we use pointer scan with queue of bad timestamps.
    bad_ts = []

    for i in range(len(df)):
        t0 = int(df.loc[i, "ts_ms"])
        # advance j to include up to t0 + window
        t_end = t0 + window_ms
        while j < len(df) and int(df.loc[j, "ts_ms"]) <= t_end:
            # if row j is "bad" event tick
            if (safe_num(df.loc[j, "miss"], 0) > safe_num(df.loc[i, "miss"], 0)) or (safe_num(df.loc[j, "hitJunk"], 0) > safe_num(df.loc[i, "hitJunk"], 0)):
                bad_ts.append(int(df.loc[j, "ts_ms"]))
            j += 1

        # remove bad timestamps <= t0 (must be strictly future)
        while bad_ts and bad_ts[0] <= t0:
            bad_ts.pop(0)

        y[i] = 1 if len(bad_ts) > 0 else 0

    # build X
    X = df[FEATURES].to_numpy(dtype=np.float64)
    return X, y

def main():
    args = parse_args()
    df = pd.read_csv(args.csv)

    # If your CSV uses different names, map here:
    # Example mapping:
    # df.rename(columns={"medianRtGoodMs":"medianRtGoodMs"}, inplace=True)

    X, y = build_dataset(df, args.label_window_sec)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.seed, stratify=y if len(np.unique(y)) > 1 else None
    )

    scaler = StandardScaler()
    X_train_z = scaler.fit_transform(X_train)
    X_test_z  = scaler.transform(X_test)

    clf = LogisticRegression(
        solver="lbfgs",
        max_iter=200,
        random_state=args.seed,
    )
    clf.fit(X_train_z, y_train)

    # metrics
    p_test = clf.predict_proba(X_test_z)[:, 1] if len(np.unique(y_test)) > 1 else np.full_like(y_test, 0.5, dtype=np.float64)
    pred_test = (p_test >= 0.5).astype(np.int64)

    auc = float(roc_auc_score(y_test, p_test)) if len(np.unique(y_test)) > 1 else 0.5
    acc = float(accuracy_score(y_test, pred_test))

    # export
    out = {
        "schema": "goodjunk-risk-logreg-v1",
        "trainedAtIso": datetime.now(timezone.utc).isoformat(),
        "notes": "Trained via train_goodjunk.py. Replace starter weights with this file.",
        "features": FEATURES,
        "bias": float(clf.intercept_[0]),
        "weights": [float(x) for x in clf.coef_[0].tolist()],
        "scaler": {
            "mean": [float(x) for x in scaler.mean_.tolist()],
            "scale": [float(x) for x in scaler.scale_.tolist()],
        },
        "metrics": {
            "auc": auc,
            "acc": acc,
            "label_window_sec": float(args.label_window_sec),
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
            "pos_rate": float(np.mean(y)),
        }
    }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print("✅ Exported:", args.out)
    print("AUC:", auc, "ACC:", acc, "pos_rate:", float(np.mean(y)))

if __name__ == "__main__":
    main()