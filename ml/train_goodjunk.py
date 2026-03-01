# === /webxr-health-mobile/ml/train_goodjunk.py ===
"""
GoodJunk ML Trainer (starter)
- Reads CSV exported from Google Sheet (events/sessions) or local exports
- Trains a simple baseline linear model (logistic regression-like)
- Exports to: /webxr-health-mobile/herohealth/vr/models/goodjunk-baseline.json

FULL v20260301-TRAIN-STARTER

Usage example:
  python train_goodjunk.py --events ./data/events.csv --out ../herohealth/vr/models/goodjunk-baseline.json
"""

import argparse
import json
import math
import os
import csv

FEATURES = [
  "missJunkHit",
  "missGoodExpired",
  "shield",
  "combo",
  "fever",
  "diff_hard",
  "view_cvr",
]

def sigmoid(z: float) -> float:
  if z < -30: return 0.0
  if z > 30: return 1.0
  return 1.0 / (1.0 + math.exp(-z))

def parse_int(x, default=0):
  try:
    return int(float(x))
  except Exception:
    return default

def parse_float(x, default=0.0):
  try:
    return float(x)
  except Exception:
    return default

def read_events_csv(path: str):
  rows = []
  with open(path, "r", encoding="utf-8-sig", newline="") as f:
    r = csv.DictReader(f)
    for row in r:
      rows.append(row)
  return rows

def featurize_from_events(events):
  """
  Minimal: build training samples from 'score_tick' metric events
  Expected columns (from logger):
    event_name, miss, combo, shield, rt_ms, accuracy_pct, meta_json, difficulty, view_mode
  We'll map:
    missJunkHit / missGoodExpired: not directly available -> put miss as proxy (starter)
  Label:
    y=1 if hazard high (miss increasing) else 0 (starter)
  Replace with real label later (e.g., junk hit in next N seconds, fail end, etc.)
  """
  X, Y = [], []
  miss_prev = None
  for e in events:
    if (e.get("event_name") or "") != "score_tick":
      continue

    miss = parse_int(e.get("miss") or e.get("missTotal") or 0)
    combo = parse_int(e.get("combo") or 0)
    shield = parse_int(e.get("shield") or 0)
    fever = parse_int(e.get("fever") or 0)

    diff = (e.get("difficulty") or e.get("diff") or "").lower()
    view = (e.get("view_mode") or e.get("view") or "").lower()

    # proxies (starter)
    miss_junk = miss
    miss_exp  = 0

    x = {
      "missJunkHit": miss_junk,
      "missGoodExpired": miss_exp,
      "shield": shield,
      "combo": combo,
      "fever": fever,
      "diff_hard": 1 if diff == "hard" else 0,
      "view_cvr": 1 if view == "cvr" else 0,
    }

    # label (starter): hazard if miss increases
    if miss_prev is None:
      y = 0
    else:
      y = 1 if miss > miss_prev else 0
    miss_prev = miss

    X.append(x)
    Y.append(y)

  return X, Y

def train_linear_logreg(X, Y, lr=0.05, steps=400):
  # simple SGD logistic regression
  w = {k: 0.0 for k in FEATURES}
  b = 0.0

  for step in range(steps):
    for x, y in zip(X, Y):
      z = b + sum(w[k] * float(x.get(k, 0.0)) for k in FEATURES)
      p = sigmoid(z)
      # gradient
      g = (p - y)
      b -= lr * g
      for k in FEATURES:
        w[k] -= lr * g * float(x.get(k, 0.0))

  return b, w

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("--events", required=True, help="events CSV exported from sheet")
  ap.add_argument("--out", required=True, help="output model json path under herohealth/vr/models/")
  ap.add_argument("--steps", type=int, default=400)
  ap.add_argument("--lr", type=float, default=0.05)
  args = ap.parse_args()

  events = read_events_csv(args.events)
  X, Y = featurize_from_events(events)
  if len(X) < 50:
    print(f"[WARN] only {len(X)} samples. Model will be weak. Collect more play sessions.")
  b, w = train_linear_logreg(X, Y, lr=args.lr, steps=args.steps)

  model = {
    "name": "goodjunk-baseline-train-v1",
    "type": "linear",
    "bias": b,
    "weights": w,
    "nextHints": ["🛡️ หาโล่ก่อน", "🍟🍔 เลี่ยงของเสีย", "⏱ เร็วขึ้น: ของดีหาย", "🎯 ยิงชัวร์", "✅ คุมจังหวะดี"]
  }

  out_path = args.out
  os.makedirs(os.path.dirname(out_path), exist_ok=True)
  with open(out_path, "w", encoding="utf-8") as f:
    json.dump(model, f, ensure_ascii=False, indent=2)

  print("[OK] wrote model ->", out_path)
  print("[INFO] bias =", b)
  print("[INFO] weights =", w)

if __name__ == "__main__":
  main()
