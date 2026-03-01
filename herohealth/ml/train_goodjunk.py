# === /webxr-health-mobile/herohealth/ml/train_goodjunk.py ===
# Train GoodJunk risk model (baseline) from CSV logs
# FULL v20260301-TRAIN-GOODJUNK
#
# Input: exported CSV from Google Sheet (events + sessions)
# Output: JSON weights to paste into goodjunk-model.js
#
# NOTE: This is a starter baseline (logistic regression). You can swap to DL later.

import json
import pandas as pd
import numpy as np
from pathlib import Path

def sigmoid(x):
  x = np.clip(x, -20, 20)
  return 1.0 / (1.0 + np.exp(-x))

def main():
  base = Path(__file__).resolve().parent
  # expects you to put files here:
  #   herohealth/ml/data/goodjunk_events.csv
  #   herohealth/ml/data/goodjunk_sessions.csv
  ev_path = base / "data" / "goodjunk_events.csv"
  ss_path = base / "data" / "goodjunk_sessions.csv"

  if not ev_path.exists() or not ss_path.exists():
    raise SystemExit(f"Missing data CSV. Put:\n- {ev_path}\n- {ss_path}\n")

  ev = pd.read_csv(ev_path)
  ss = pd.read_csv(ss_path)

  # --- Example labeling ---
  # label = 1 (high risk) if within a short window player accumulates misses fast
  # For starter: use session-level label: missRate >= 0.25 OR acc < 75 OR medianRt > 1100
  # Adjust as you like.
  ss["hits"] = pd.to_numeric(ss.get("hits", 0), errors="coerce").fillna(0)
  ss["miss"] = pd.to_numeric(ss.get("miss", 0), errors="coerce").fillna(0)
  ss["accuracy_pct"] = pd.to_numeric(ss.get("accuracy_pct", 0), errors="coerce").fillna(0)
  ss["median_rt"] = pd.to_numeric(ss.get("medianRtGoodMs", ss.get("median_rt", 0)), errors="coerce").fillna(0)

  denom = (ss["hits"] + ss["miss"]).replace(0, 1)
  ss["miss_rate"] = ss["miss"] / denom

  y = ((ss["miss_rate"] >= 0.25) | (ss["accuracy_pct"] < 75) | (ss["median_rt"] > 1100)).astype(int).values

  # --- Features: align with goodjunk-model.js order after featurize scaling ---
  # Here we approximate from session-level. For better ML, train on event windows.
  X = pd.DataFrame({
    "tLeft": np.ones(len(ss))*0.2,
    "stage": np.ones(len(ss))*2.0,
    "score": pd.to_numeric(ss.get("score", 0), errors="coerce").fillna(0) / 1000.0,
    "combo": pd.to_numeric(ss.get("combo_max", ss.get("comboMax", 0)), errors="coerce").fillna(0) / 20.0,
    "miss": ss["miss"] / 10.0,
    "accPct": (100.0 - ss["accuracy_pct"]) / 50.0,
    "medianRtGoodMs": (ss["median_rt"] - 700.0) / 600.0,
    "fever": np.ones(len(ss))*0.6,
    "shield": np.ones(len(ss))*0.7,
    "onScreen": np.ones(len(ss))*0.5,
    "spawnMs": np.ones(len(ss))*0.2,
    "lifeMs": np.ones(len(ss))*0.2,
  }).values.astype(float)

  # --- Simple logistic regression via gradient descent ---
  n, d = X.shape
  w = np.zeros(d)
  b = 0.0
  lr = 0.08

  for epoch in range(900):
    z = X @ w + b
    p = sigmoid(z)
    # gradients
    gw = (X.T @ (p - y)) / n
    gb = np.mean(p - y)
    w -= lr * gw
    b -= lr * gb
    if epoch % 150 == 0:
      loss = -np.mean(y*np.log(p+1e-9) + (1-y)*np.log(1-p+1e-9))
      print(f"epoch {epoch} loss {loss:.4f}")

  out = {
    "version": "goodjunk-logit-v1-trained",
    "w": [float(x) for x in w],
    "b": float(b),
    "thresholds": {"low": 0.35, "mid": 0.60, "high": 0.78}
  }

  out_path = base / "goodjunk_model_weights.json"
  out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
  print("Wrote:", out_path)

if __name__ == "__main__":
  main()